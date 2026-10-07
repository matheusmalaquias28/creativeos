/**
 * Worker de geração em lote com concorrência limitada.
 * Processa jobs com status 'queued' da tabela art_generation_job.
 *
 * A geração vai pelo provedor configurado (Magnific por padrão, Gemini com
 * IMAGE_PROVIDER=gemini) — `params.model` continua ignorado. Por job:
 *   1. monta o prompt: referências → briefing do diretor → padrões fixos;
 *   2. gera a imagem no provedor;
 *   3. compõe a logo real (sem fundo, contraste garantido, topo central);
 *   4. revisão automática com visão; se reprovar, UMA nova tentativa com as
 *      correções anexadas ao prompt (fica a melhor das duas);
 *   5. salva a arte final (v1.png) e a versão sem logo (v1_raw.png), usada
 *      pelos ajustes para recompor a logo sem duplicá-la.
 *
 * Timeout: IMAGE_JOB_TIMEOUT_MS (padrão 4min — cobre duas gerações + revisões)
 * por geração. No Space o lote do node roda em paralelo (SPACE_FANOUT_CONCURRENCY)
 * e o timeout do job escala com o número de rodadas.
 * Cancelamento: ao marcar o job como 'failed' externamente, o worker respeita.
 *
 * Versionamento: a numeração corre por FORMATO ('feed' 3:4 e 'story' 9:16).
 * Regerar uma arte grava v2, v3… em vez de tentar reescrever v1 — era isso que
 * estourava o unique (job_id, version_number) e derrubava toda regeração.
 *
 * `runStoryWorker` faz a segunda etapa: pega a arte aprovada e a reenquadra em
 * 9:16 (ver lib/ai/imagegen/story.ts). Nenhuma direção de arte nova, nenhuma
 * logo recomposta — a peça já foi aprovada como está.
 */

import pLimit from "p-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateArtImage } from "./provider";
import { urlToInlineDataPart } from "./storage-refs";
import { compositeBrandLogo, prepareLogo } from "./brand-logo";
import { compilePrompt } from "./prompt-compiler";
import { buildLogoDirective } from "@/lib/flow/logo-directive";
import { adaptArtToStory } from "./story";
import {
  appendTechnicalBlock,
  buildStandardsBlock,
  LOGO_ZONE_BAND,
  type TechnicalBlockSpec,
} from "@/lib/ai/art-director/technical-block";
import { reviewArt, type ArtReview } from "@/lib/ai/art-director/review-art";
import { ART_ASPECT_RATIO } from "@/lib/ai/art-director/constants";
import type { DirectionMeta, ReferenceRole } from "@/lib/ai/art-director/types";
import { IMAGE_GEN_DEFAULTS } from "./defaults";
import { buildSpaceRequest, spacePromptFor, SPACE_MAX_COUNT } from "./space-request";
import type { LogoPlacement } from "./logo-composite";
import type { CreativeProfile, ArtSpec, BriefingCopy, DemandReference } from "./prompt-compiler";
import { CATEGORY_META, isReferenceCategory } from "@/lib/image-library/categories";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_CONCURRENCY = Number(process.env.IMAGE_MAX_CONCURRENCY ?? "5");
const JOB_TIMEOUT_MS = Number(process.env.IMAGE_JOB_TIMEOUT_MS ?? String(4 * 60 * 1000)); // 4min
/** Revisão automática com visão. Desligue com ART_REVIEW_ENABLED=0. */
const REVIEW_ENABLED = process.env.ART_REVIEW_ENABLED !== "0";
/** Gerações por job, contando a primeira (1 = sem nova tentativa). */
const MAX_ATTEMPTS = Math.max(1, Number(process.env.ART_REVIEW_MAX_ATTEMPTS ?? "2"));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobRow = {
  id: string;
  demand_id: string;
  client_id: string | null;
  art_index: number;
  /** Prompt escrito pelo diretor de arte (null no fluxo legado). */
  prompt_draft?: string | null;
  /** Edição do operador sobre o rascunho. Vence o rascunho quando existe. */
  prompt_edited?: string | null;
  direction?: DirectionMeta | null;
  /** Job do Space/flow — suas versões expiram (TTL de 15 dias). */
  ephemeral?: boolean;
  params: {
    headline?: string | null;
    subheadline?: string | null;
    cta?: string | null;
    informacoesExtras?: string | null;
    aspect_ratio?: string;
    image_size?: string;
    model?: string;
    quality?: "low" | "medium" | "high";
    count?: number;
    fanout_reference_urls?: string[] | null;
    skip_logo?: boolean;
    logo_position?: string | null;
    logo_size?: string | null;
    logo_directive?: string | null;
    prompt_text?: string | null;
    briefing_titulo?: string | null;
    briefing_tipo?: string | null;
    extra_reference_urls?: string[] | null;
    flow_logo_url?: string | null;
    flow_references?: { url: string; role: string | null }[] | null;
  };
};

type ProfileRow = {
  base_prompt: string;
  palette: string[];
  style_reference_urls: string[];
  logo_url: string | null;
  logo_mode: string;
  logo_placement: LogoPlacement;
  image_size: string;
  aspect_ratio: string;
};

type DemandRefRow = {
  storage_url: string;
  role: string | null;
  position: number;
  arte_index: number | null;
  category: string | null;
};

/** Referência resolvida pela camada de direção de arte — fonte única da ordem. */
type DirectedRefRow = {
  storage_url: string;
  role: ReferenceRole;
  intent: string | null;
  position: number;
};

export type ArtFormat = "feed" | "story";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Próximo número de versão DENTRO do formato. Ler o máximo e somar 1 (em vez de
 * fixar 1) é o que permite regerar uma arte sem colidir com a versão anterior.
 */
async function nextVersionNumber(
  supabase: ReturnType<typeof createAdminClient>,
  jobId: string,
  format: ArtFormat
): Promise<number> {
  const { data } = await supabase
    .from("art_version")
    .select("version_number")
    .eq("job_id", jobId)
    .eq("format", format)
    .order("version_number", { ascending: false })
    .limit(1);

  const last = (data ?? [])[0]?.version_number as number | undefined;
  return (last ?? 0) + 1;
}

/**
 * Grava a nova versão e move o `is_current` dentro do formato. Feed e story têm
 * cada um a sua versão atual — a aba de stories não pode roubar a arte 3:4.
 */
async function publishVersion(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    jobId: string;
    format: ArtFormat;
    versionNumber: number;
    resultUrl: string;
    storagePath: string;
    instruction: string | null;
    /** TTL: quando setado, a imagem é apagada pela limpeza do Space (jobs efêmeros). */
    expiresAt?: string | null;
  }
): Promise<void> {
  await supabase
    .from("art_version")
    .update({ is_current: false })
    .eq("job_id", params.jobId)
    .eq("format", params.format);

  const { error } = await supabase.from("art_version").insert({
    job_id: params.jobId,
    version_number: params.versionNumber,
    format: params.format,
    result_url: params.resultUrl,
    storage_path: params.storagePath,
    instruction: params.instruction,
    is_current: true,
    expires_at: params.expiresAt ?? null,
  });

  if (error) throw new Error(error.message);
}

/** TTL do Space: 15 dias a partir de agora (ISO), ou null quando não efêmero. */
const SPACE_TTL_DAYS = 15;
function ttlExpiresAt(ephemeral: boolean | undefined): string | null {
  if (!ephemeral) return null;
  return new Date(Date.now() + SPACE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Quantas gerações do lote de um node do Space rodam em paralelo. */
const SPACE_CONCURRENCY = Math.max(1, Number(process.env.SPACE_FANOUT_CONCURRENCY ?? "6"));

/** Tamanho do lote: 1 geração por item da Lista (fan-out) ou `count` variações. */
function batchSize(params: JobRow["params"]): number {
  const fanout = params.fanout_reference_urls?.length ?? 0;
  return fanout > 0 ? fanout : Math.min(SPACE_MAX_COUNT, Math.max(1, params.count ?? 1));
}

/** Timeout do job inteiro: cada rodada de gerações paralelas tem o seu. */
function jobTimeoutMs(job: JobRow): number {
  const rounds = Math.ceil(batchSize(job.params) / (job.ephemeral ? SPACE_CONCURRENCY : 1));
  return JOB_TIMEOUT_MS * Math.max(1, rounds);
}

/** Rate limit do provedor (várias gerações em paralelo): espera e tenta de novo. */
async function withRateLimitRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/\b429\b|rate.?limit/i.test(message) || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout após ${ms / 1000}s: ${label}`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// ---------------------------------------------------------------------------
// uploadArtToStorage
// ---------------------------------------------------------------------------

async function uploadArtToStorage(params: {
  buffer: Buffer;
  jobId: string;
  versionNumber: number;
  /** 'feed' (3:4) ou 'story' (9:16). Entra no nome do arquivo. */
  format?: ArtFormat;
  /** Versão sem logo (insumo dos ajustes). */
  raw?: boolean;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const supabase = createAdminClient();
  const { buffer, jobId, versionNumber, format = "feed", raw } = params;
  const mimeType = "image/png";
  const prefix = format === "story" ? "story-v" : "v";
  const storagePath = `${jobId}/${prefix}${versionNumber}${raw ? "_raw" : ""}.png`;

  const { error } = await supabase.storage
    .from("art-generations")
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from("art-generations").getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

// ---------------------------------------------------------------------------
// processJob — processa um único job (com timeout)
// ---------------------------------------------------------------------------

async function processJob(job: JobRow): Promise<void> {
  const supabase = createAdminClient();

  // Verifica se o job ainda está queued (pode ter sido cancelado externamente)
  const { data: current } = await supabase
    .from("art_generation_job")
    .select("status")
    .eq("id", job.id)
    .single();

  if (!current || current.status !== "queued") return;

  // Marca como processing
  await supabase
    .from("art_generation_job")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", job.id);

  try {
    await withTimeout(runJob(job, supabase), jobTimeoutMs(job), `job ${job.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const { data: jobState } = await supabase
      .from("art_generation_job")
      .select("attempts, status")
      .eq("id", job.id)
      .single();

    // Não sobrescreve se o job foi cancelado manualmente (status=failed já)
    if (jobState?.status === "processing") {
      await supabase
        .from("art_generation_job")
        .update({
          status: "failed",
          error: message,
          attempts: (jobState?.attempts ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }
}

async function runJob(
  job: JobRow,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  // Carrega perfil criativo do cliente
  const { data: profileData, error: profileError } = await supabase
    .from("client_creative_profile")
    .select("*")
    .eq("client_id", job.client_id!)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const profile = profileData as ProfileRow | null;

  // Carrega referências pontuais da demanda (ordenadas por position)
  const { data: demandRefRows } = await supabase
    .from("demand_reference_image")
    .select("storage_url, role, position, arte_index, category")
    .eq("demand_id", job.demand_id)
    .order("position", { ascending: true });

  // Imagens do acervo escolhidas para uma arte específica só entram no job
  // dessa arte, com a instrução da categoria como papel.
  const demandRefs: DemandReference[] = (demandRefRows ?? [])
    .filter((r: DemandRefRow) => r.arte_index === null || r.arte_index === job.art_index)
    .map((r: DemandRefRow) => ({
      url: r.storage_url,
      role: isReferenceCategory(r.category)
        ? `${CATEGORY_META[r.category].label}: ${CATEGORY_META[r.category].instruction}`
        : r.role,
    }));

  // Referências escolhidas pelo diretor de arte, já ordenadas. Quando existem,
  // elas são a ordem canônica — não há espelhamento com buildOrderedRefs.
  const { data: directedRefRows } = await supabase
    .from("art_job_reference")
    .select("storage_url, role, intent, position")
    .eq("job_id", job.id)
    .order("position", { ascending: true });

  const directedRefs = (directedRefRows ?? []) as DirectedRefRow[];
  const approvedPrompt = (job.prompt_edited ?? job.prompt_draft)?.trim() || null;

  const flowRefs = job.params.flow_references ?? [];
  const flowLogoUrl = job.params.flow_logo_url ?? null;
  const usesFlowGraph = flowRefs.length > 0 || Boolean(flowLogoUrl);

  // Extra references resolved from legacy @(name) token path (non-flow queue)
  const extraRefs: DemandReference[] = (job.params.extra_reference_urls ?? []).map(
    (url) => ({
      url,
      role: "referência visual adicional indicada no prompt",
    })
  );

  const flowDemandRefs: DemandReference[] = flowRefs.map((ref) => ({
    url: ref.url,
    role: ref.role,
  }));

  // Job efêmero (Space): `demand_reference_image` já foi materializada como
  // node `referenciaImagem` no grafo antes de extrair o job (ver
  // syncAndPersistDemandReferences em services/flow.ts) — por isso já está
  // em flowDemandRefs. Somar `demandRefs` aqui mandaria a MESMA imagem duas
  // vezes pro modelo.
  const allDemandRefs = job.ephemeral === true
    ? flowDemandRefs
    : usesFlowGraph
      ? [...flowDemandRefs, ...demandRefs]
      : [...demandRefs, ...extraRefs];

  const artSpec: ArtSpec = {
    headline: job.params.headline,
    subheadline: job.params.subheadline,
    cta: job.params.cta,
    informacoesExtras: job.params.informacoesExtras,
    // Camada de direção de arte: 3:4 SEMPRE, seja qual for o perfil ou o que
    // veio na arte do Make. O fluxo legado mantém a resolução antiga.
    aspect_ratio: approvedPrompt
      ? ART_ASPECT_RATIO
      : job.params.aspect_ratio ?? profile?.aspect_ratio ?? IMAGE_GEN_DEFAULTS.aspectRatio,
    image_size: job.params.image_size ?? profile?.image_size ?? IMAGE_GEN_DEFAULTS.imageSize,
  };

  const briefing: BriefingCopy = {
    titulo: job.params.briefing_titulo,
    tipo: job.params.briefing_tipo,
  };

  const creativeProfile: CreativeProfile = {
    // Job efêmero (Space): base_prompt/paleta já foram semeados como linha
    // visível no prompt pelo enrich-graph.ts antes da extração — incluir de
    // novo aqui mandaria a MESMA coisa pro modelo por um canal invisível.
    base_prompt: job.ephemeral === true ? "" : profile?.base_prompt ?? "",
    palette: job.ephemeral === true ? [] : (profile?.palette as string[]) ?? [],
    // Job efêmero: a logo é 100% decidida pelo node clienteLogo conectado
    // (ou não) nessa arte — nunca pelo `logo_mode` global do cliente.
    // "composite" aqui só evita que buildOrderedRefs invente uma entrada de
    // logo na lista de referências sem imagem correspondente de verdade.
    logo_mode:
      job.ephemeral === true
        ? "composite"
        : (profile?.logo_mode as "reference" | "composite") ?? "composite",
    // Job efêmero: referências de estilo fixas do cliente só entram se
    // estiverem conectadas no canvas (clienteReferencias) — `usesFlowGraph`
    // dava falso-negativo numa arte sem NADA conectado (sem refs, sem logo),
    // que ainda assim cairia nesse fallback e herdaria as referências fixas
    // do cliente sem nenhum indício disso em Spaces.
    style_reference_urls:
      job.ephemeral === true ? [] : (profile?.style_reference_urls as string[]) ?? [],
  };

  // Stories reenquadra uma arte que JÁ tem a logo — recompor duplicaria.
  const skipLogo = job.params.skip_logo === true;

  let effectiveLogoUrl: string | null;
  if (job.ephemeral === true) {
    // Space: só usa o que está CONECTADO no canvas dessa arte específica.
    // Sem node clienteLogo conectado = sem logo nessa geração — nunca cai
    // escondido pro perfil/onboarding do cliente por fora do que o operador
    // vê e decide no grafo (desconectar a logo é uma escolha visível e vale).
    effectiveLogoUrl = skipLogo ? null : (flowLogoUrl?.trim() || null);
  } else {
    // Pipeline legado (sem canvas pra mostrar) — aqui sim cai no perfil do
    // cliente, e depois no onboarding, com logo obrigatória.
    effectiveLogoUrl = flowLogoUrl?.trim() || profile?.logo_url?.trim() || null;
    if (!skipLogo && !effectiveLogoUrl && job.client_id) {
      const { data: onboarding, error: logoError } = await supabase
        .from("onboarding_answers").select("answers").eq("client_id", job.client_id).maybeSingle();
      if (logoError) throw new Error("Não foi possível carregar a logo do cliente");
      const answers = onboarding?.answers as { logoUrl?: unknown } | null;
      effectiveLogoUrl = typeof answers?.logoUrl === "string" ? answers.logoUrl.trim() || null : null;
    }
    if (!skipLogo && !effectiveLogoUrl) {
      throw new Error("Logo do cliente não encontrada. Cadastre a logo antes de gerar; a arte não será entregue sem ela.");
    }
  }

  const textSpec: TechnicalBlockSpec = {
    headline: artSpec.headline,
    subheadline: artSpec.subheadline,
    cta: artSpec.cta,
    informacoesExtras: artSpec.informacoesExtras,
    aspectRatio: artSpec.aspect_ratio,
    imageSize: artSpec.image_size,
  };

  // No Space (ephemeral) a logo vai como REFERÊNCIA pro modelo — ele passa a
  // saber que a logo existe e reserva espaço pra ela, em vez de gerar
  // texto/elementos onde a logo sobreposta cairia. Nos demais fluxos a logo
  // continua sendo composta depois (nítida, pixel-perfect).
  const logoAsReference = job.ephemeral === true && !skipLogo && !!effectiveLogoUrl;
  // `logo_directive` já foi resolvido na extração a partir da linha
  // `@(logo) — ...` do prompt (ver extract-flow-jobs.ts) — é a mesma frase
  // que o operador vê no node. Só recai no cálculo a partir de
  // logo_position/logo_size para jobs antigos, enfileirados antes dessa
  // mudança, que nunca tiveram esse campo.
  const logoDirective = logoAsReference
    ? job.params.logo_directive ??
      buildLogoDirective(job.params.logo_position ?? undefined, job.params.logo_size ?? undefined)
    : null;

  // Space: prompt, referências e lote vêm da MESMA montagem que o preview do
  // node exibe (`/flow/preview-node`) — o que aparece no node é o que vai.
  const space =
    job.ephemeral === true && !approvedPrompt
      ? buildSpaceRequest(job.params, {
          aspectRatio: artSpec.aspect_ratio ?? IMAGE_GEN_DEFAULTS.aspectRatio,
          imageSize: artSpec.image_size ?? IMAGE_GEN_DEFAULTS.imageSize,
        })
      : null;

  const styleRefs = directedRefs.filter((r) => r.role !== "logo");
  const references = approvedPrompt
    ? styleRefs.map((r) => ({ url: r.storage_url, intent: r.intent ?? r.role }))
    : space
    ? space.references.map((r) => ({ url: r.url, intent: r.intent }))
    : [
        ...(logoAsReference ? [{ url: effectiveLogoUrl!, intent: logoDirective! }] : []),
        ...creativeProfile.style_reference_urls.map((url) => ({
          url,
          intent: "referência de estilo do cliente",
        })),
        ...allDemandRefs.map((r) => ({ url: r.url, intent: r.role })),
      ];

  const buildPrompt = (
    fixNotes?: string[],
    extraRef?: { url: string; intent: string } | null
  ): string => {
    if (approvedPrompt) {
      // Camada de direção de arte: o briefing aprovado carrega o design,
      // o bloco técnico impõe os padrões de produto.
      return appendTechnicalBlock(
        approvedPrompt,
        textSpec,
        styleRefs.map((r) => ({ role: r.role, intent: r.intent })),
        fixNotes,
        job.direction?.negative
      );
    }
    // Space (canvas): a direção criativa do operador vai literal, sem o colete
    // de força do pipeline estruturado. Demais fluxos sem diretor mantêm o
    // compilador clássico + padrões.
    // No Space, as imagens anexadas abrem o prompt, numeradas na ordem desta
    // geração (no fan-out o item da lista é a Imagem 1).
    const parts = space
      ? [spacePromptFor(space, space.batch.find((b) => b && b.url === extraRef?.url) ?? null)]
      : [
          compilePrompt(creativeProfile, briefing, artSpec, allDemandRefs),
          buildStandardsBlock(textSpec),
        ];
    if (fixNotes?.length) {
      parts.push(
        ["A PREVIOUS ATTEMPT FAILED REVIEW. Fix all of these:", ...fixNotes.map((n) => `- ${n}`)].join("\n")
      );
    }
    return parts.join("\n\n");
  };

  // Quando a logo vai como referência (Space), não compõe depois — senão ela
  // apareceria duas vezes. Composite segue nos demais fluxos.
  const cleanLogo =
    effectiveLogoUrl && !logoAsReference
      ? await prepareLogo(
          Buffer.from((await urlToInlineDataPart(effectiveLogoUrl)).inlineData.data, "base64")
        )
      : null;

  type Candidate = { raw: Buffer; final: Buffer; prompt: string; review: ArtReview | null; attempts: number };

  // Gera UMA arte (com o loop de revisão/retry escolhendo o melhor candidato).
  // `extraRef`, quando presente, é o item da Lista em modo fan-out — entra como
  // referência principal daquela geração.
  const generateBestCandidate = async (
    extraRef: { url: string; intent: string } | null
  ): Promise<Candidate> => {
    const candidateRefs = extraRef
      ? [extraRef, ...references.filter((r) => r.url !== extraRef.url)]
      : references;
    let best: Candidate | null = null;
    let fixNotes: string[] | undefined;
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      const prompt = buildPrompt(fixNotes, extraRef);

      const raw = await withRateLimitRetry(() =>
        generateArtImage({
          prompt,
          references: candidateRefs,
          imageSize: artSpec.image_size ?? "2K",
          aspectRatio: artSpec.aspect_ratio ?? IMAGE_GEN_DEFAULTS.aspectRatio,
          // Esforço do GPT Image vindo do node (ignorado por Magnific/Gemini).
          quality: job.params.quality ?? "medium",
          // Space: o papel de cada imagem já abre o prompt — o provedor não anexa de novo.
          referencesInPrompt: space !== null,
        })
      );
      const logoResult = cleanLogo
        ? await compositeBrandLogo({ art: raw, logo: cleanLogo, palette: creativeProfile.palette })
        : null;
      const final = logoResult?.buffer ?? raw;

      let review: ArtReview | null = null;
      if (REVIEW_ENABLED) {
        try {
          review = await reviewArt({ image: final, spec: textSpec });
        } catch (err) {
          // Revisão é filtro de qualidade: se falhar, a arte segue para a curadoria.
          console.warn("[worker] revisão falhou:", (err as Error)?.message ?? err);
        }
      }

      // Checagem objetiva: logo atravessando borda/objeto reprova mesmo que a
      // revisão visual tenha passado.
      if (logoResult && !logoResult.backgroundOk) {
        review = {
          pass: false,
          score: Math.min(review?.score ?? 6, 6),
          fixes: [
            ...(review?.fixes ?? []),
            `The top band from 0% to ${Math.round(LOGO_ZONE_BAND.to * 100)}% of the height, across the middle 60% of the width, must be ONE uniform calm background area — move any edge, colour block, photo border, paper, tape, object or text out of it.`,
          ],
        };
      }

      if (!best || (review?.pass && !best.review?.pass) ||
          (Boolean(review?.pass) === Boolean(best.review?.pass) && (review?.score ?? 0) > (best.review?.score ?? 0))) {
        best = { raw, final, prompt, review, attempts };
      }

      if (!review || review.pass) break;
      fixNotes = review.fixes;
    }

    if (!best) throw new Error("Nenhuma arte gerada");
    return best;
  };

  // Lote de gerações para este node: fan-out (1 por item da Lista, sem teto) OU
  // `count` variações do mesmo prompt. Cada uma vira uma versão na pilha do node.
  const fanout = job.params.fanout_reference_urls ?? null;
  const batch: ({ url: string; intent: string } | null)[] = space
    ? space.batch.map((item) => (item ? { url: item.url, intent: item.intent } : null))
    : fanout && fanout.length > 0
      ? fanout.map((url) => ({ url, intent: "item da lista — base principal desta arte" }))
      : Array.from({ length: Math.min(SPACE_MAX_COUNT, Math.max(1, job.params.count ?? 1)) }, () => null);

  const isCancelled = async () => {
    const { data } = await supabase
      .from("art_generation_job")
      .select("status")
      .eq("id", job.id)
      .single();
    return data?.status !== "processing";
  };

  // Publica uma geração: upload + galeria + nova versão. Serializado — a
  // numeração lê o máximo e soma 1, então duas publicações juntas colidiriam.
  const publishLock = pLimit(1);
  const publish = (best: Candidate, isListItem: boolean) =>
    publishLock(async () => {
      // Upload ao Storage — final (com logo) e raw (sem logo, insumo dos ajustes).
      const versionNumber = await nextVersionNumber(supabase, job.id, "feed");
      const { publicUrl, storagePath } = await uploadArtToStorage({
        buffer: best.final,
        jobId: job.id,
        versionNumber,
      });
      await uploadArtToStorage({ buffer: best.raw, jobId: job.id, versionNumber, raw: true }).catch(
        (err) => console.warn("[worker] upload da versão sem logo falhou:", (err as Error)?.message ?? err)
      );

      // Registra na Galeria (não-fatal)
      await supabase.from("generated_images").insert({
        source: "artes",
        prompt: artSpec.headline ?? briefing.titulo ?? "",
        aspect_ratio: artSpec.aspect_ratio ?? "1:1",
        resolution: artSpec.image_size ?? "2K",
        storage_path: storagePath,
        url: publicUrl,
      }).then(({ error }) => {
        if (error) console.error("[worker] galeria insert falhou:", error.message);
      });

      // Nova versão do formato feed — empilha (v1, v2, …); a última fica is_current.
      await publishVersion(supabase, {
        jobId: job.id,
        format: "feed",
        versionNumber,
        resultUrl: publicUrl,
        storagePath,
        instruction: isListItem ? "item da lista" : versionNumber > 1 ? "variação" : null,
        expiresAt: ttlExpiresAt(job.ephemeral),
      });
    });

  // As gerações do lote rodam em PARALELO no Space (em série nos demais
  // fluxos), cada uma com o próprio timeout. Antes era tudo em série dentro de
  // um único timeout — listas com mais de ~4 itens estouravam o tempo. Cada
  // geração publica assim que fica pronta; uma falha isolada não derruba as outras.
  const limit = pLimit(space ? SPACE_CONCURRENCY : 1);
  const errors: string[] = [];
  let lastBest: Candidate | null = null;

  await Promise.all(
    batch.map((item) =>
      limit(async () => {
        if (await isCancelled()) return;
        try {
          const best = await withTimeout(generateBestCandidate(item), JOB_TIMEOUT_MS, `geração do job ${job.id}`);
          if (await isCancelled()) return;
          await publish(best, item !== null);
          lastBest = best;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[worker] geração do lote falhou:", message);
          errors.push(message);
        }
      })
    )
  );

  if (!lastBest) {
    if (await isCancelled()) return;
    throw new Error(errors[0] ?? "Nenhuma arte gerada");
  }
  const finalBest: Candidate = lastBest;
  const promptFinal = finalBest.prompt;

  if (job.direction && finalBest.review) {
    const direction: DirectionMeta = {
      ...job.direction,
      review: {
        pass: finalBest.review.pass,
        score: finalBest.review.score,
        attempts: finalBest.attempts,
        fixes: finalBest.review.fixes,
      },
    };
    await supabase.from("art_generation_job").update({ direction }).eq("id", job.id);
  }

  // Marca job como succeeded (se não foi pausado no meio do lote). Falhas
  // isoladas do lote ficam registradas em `error`.
  await supabase
    .from("art_generation_job")
    .update({
      status: "succeeded",
      prompt_final: promptFinal,
      error: errors.length > 0
        ? `${errors.length} de ${batch.length} gerações falharam: ${errors[0]}`
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "processing");
}

// ---------------------------------------------------------------------------
// runWorker — entry point
// ---------------------------------------------------------------------------

export type RunWorkerOptions = {
  demandId?: string;
  /** Roda apenas este job — usado pela regeração de uma arte só. */
  jobId?: string;
};

export async function runWorker(
  options?: string | RunWorkerOptions
): Promise<{ processed: number }> {
  const opts: RunWorkerOptions =
    typeof options === "string" ? { demandId: options } : (options ?? {});
  const supabase = createAdminClient();

  let query = supabase
    .from("art_generation_job")
    .select("id, demand_id, client_id, art_index, params, prompt_draft, prompt_edited, direction, ephemeral")
    .eq("status", "queued")
    .order("created_at", { ascending: true });

  if (opts.demandId) query = query.eq("demand_id", opts.demandId);
  if (opts.jobId) query = query.eq("id", opts.jobId);

  const { data: jobs, error } = await query;
  if (error) throw new Error(`Worker query failed: ${error.message}`);
  if (!jobs || jobs.length === 0) return { processed: 0 };

  const limit = pLimit(MAX_CONCURRENCY);
  await Promise.all((jobs as JobRow[]).map((job) => limit(() => processJob(job))));

  return { processed: jobs.length };
}

// ---------------------------------------------------------------------------
// runStoryWorker — adaptação 9:16 das artes aprovadas
// ---------------------------------------------------------------------------

type StoryJobRow = {
  id: string;
  art_index: number;
  params: JobRow["params"];
};

async function processStoryJob(job: StoryJobRow): Promise<void> {
  const supabase = createAdminClient();

  const { data: state } = await supabase
    .from("art_generation_job")
    .select("story_status, ephemeral")
    .eq("id", job.id)
    .single();

  // Cancelado ou já pego por outra execução.
  if (state?.story_status !== "queued") return;

  await supabase
    .from("art_generation_job")
    .update({ story_status: "processing", story_error: null, updated_at: new Date().toISOString() })
    .eq("id", job.id);

  try {
    // A arte de origem é a versão FEED atual — a peça que o operador aprovou.
    const { data: source } = await supabase
      .from("art_version")
      .select("result_url")
      .eq("job_id", job.id)
      .eq("format", "feed")
      .eq("is_current", true)
      .maybeSingle();

    const sourceUrl = source?.result_url as string | undefined;
    if (!sourceUrl) throw new Error("Arte 3:4 ainda não foi gerada");

    const png = await withTimeout(
      adaptArtToStory({ artUrl: sourceUrl, imageSize: job.params.image_size ?? "2K" }),
      JOB_TIMEOUT_MS,
      `story ${job.id}`
    );
    const versionNumber = await nextVersionNumber(supabase, job.id, "story");
    const { publicUrl, storagePath } = await uploadArtToStorage({
      buffer: png,
      jobId: job.id,
      versionNumber,
      format: "story",
    });

    await publishVersion(supabase, {
      jobId: job.id,
      format: "story",
      versionNumber,
      resultUrl: publicUrl,
      storagePath,
      instruction: "stories 9:16",
      expiresAt: ttlExpiresAt(state.ephemeral ?? undefined),
    });

    await supabase
      .from("art_generation_job")
      .update({ story_status: "succeeded", story_error: null, updated_at: new Date().toISOString() })
      .eq("id", job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("art_generation_job")
      .update({ story_status: "failed", story_error: message, updated_at: new Date().toISOString() })
      .eq("id", job.id);
  }
}

/** Processa todos os jobs com `story_status = 'queued'` (da demanda, se dada). */
export async function runStoryWorker(demandId?: string): Promise<{ processed: number }> {
  const supabase = createAdminClient();

  let query = supabase
    .from("art_generation_job")
    .select("id, art_index, params")
    .eq("story_status", "queued")
    .order("art_index", { ascending: true });

  if (demandId) query = query.eq("demand_id", demandId);

  const { data: jobs, error } = await query;
  if (error) throw new Error(`Story worker query failed: ${error.message}`);
  if (!jobs || jobs.length === 0) return { processed: 0 };

  const limit = pLimit(MAX_CONCURRENCY);
  await Promise.all((jobs as StoryJobRow[]).map((job) => limit(() => processStoryJob(job))));

  return { processed: jobs.length };
}
