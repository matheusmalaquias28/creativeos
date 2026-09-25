/**
 * A chamada de direção de arte (V2, com visão).
 *
 * Uma chamada por arte. O diretor VÊ as referências do acervo do cliente —
 * rotuladas com os mesmos tokens do catálogo (r01, r02…) — escolhe uma como
 * layout mestre e escreve o briefing de design que o modelo de imagem executa.
 * Quem escolhe a referência é quem escreve o briefing, senão os dois brigam.
 *
 * Modelo: Claude Opus 5 por padrão (julgamento visual/composicional é onde a
 * diferença de modelo mais aparece). Configurável por ART_DIRECTOR_VISION_MODEL.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  ART_DIRECTOR_OUTPUT_SCHEMA,
  ART_DIRECTOR_SYSTEM_PROMPT,
  type ArtDirectorOutput,
} from "./system-prompt";
import { isReferenceKind } from "./types";
import { urlToVisionBlock } from "./vision";
import { describeUsage } from "./catalog";
import type { ArtDirection, ArtDirectionInput, ChosenReference } from "./types";

const MAX_TOKENS = 16000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

/** Teto de referências enviadas como imagem numa chamada. */
export const MAX_VISION_REFERENCES = 10;

export function getArtDirectorModel(): string {
  return process.env.ART_DIRECTOR_VISION_MODEL?.trim() || "claude-opus-5";
}

export class ArtDirectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtDirectionError";
  }
}

// ---------------------------------------------------------------------------
// Prompt do usuário (parte em texto)
// ---------------------------------------------------------------------------

function section(title: string, body: string | null | undefined): string | null {
  const value = body?.toString().trim();
  return value ? `${title}\n${value}` : null;
}

export function buildUserPrompt(input: ArtDirectionInput): string {
  const { client, demand, art, siblings, steer, clientPhotos, assignedMaster } = input;

  // Do DNA só entram marca e tipografia: a composição vem das referências
  // (o DNA extraído achatava tudo em "foto ao fundo, texto à esquerda").
  const dna = client.dna
    ? [
        `Summary: ${client.dna.summary}`,
        `Typography: headlines ${client.dna.typography.headlineStyle}; body ${client.dna.typography.bodyStyle}${client.dna.typography.notes ? `; ${client.dna.typography.notes}` : ""}`,
        `Mood: ${client.dna.mood}`,
        client.dna.elementsToRepeat?.length
          ? `Recurring brand elements: ${client.dna.elementsToRepeat.join(", ")}`
          : null,
        client.dna.avoid?.length ? `Avoid: ${client.dna.avoid.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const copy = [
    art.headline ? `Headline: "${art.headline}"` : null,
    art.subheadline ? `Supporting line: "${art.subheadline}"` : null,
    art.informacoesExtras ? `Extra line: "${art.informacoesExtras}"` : null,
    art.cta ? `Button: "${art.cta}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const blocks = [
    section("## CLIENT", client.name),
    section("## BRAND PALETTE", client.palette.join(", ")),
    section("## BRAND NOTES (from the visual identity)", dna),
    client.directionNotes.length
      ? section(
          "## RULES LEARNED FOR THIS CLIENT (respect all)",
          client.directionNotes.map((n) => `- ${n.note}`).join("\n")
        )
      : null,
    section(
      "## CAMPAIGN",
      [demand.titulo ? `Title: ${demand.titulo}` : null, demand.tipo ? `Type: ${demand.tipo}` : null]
        .filter(Boolean)
        .join("\n")
    ),
    section(
      `## AD ${art.index + 1} COPY (Portuguese — keep exactly, including letter case)`,
      copy || "(no copy — image only)"
    ),
    section("## FORMAT", `${art.aspectRatio} portrait, ${art.imageSize}`),
    clientPhotos.length
      ? section(
          "## REAL CLIENT PHOTO",
          `${clientPhotos.length} real photo(s) of the client are attached (labelled FOTO). That person is the subject of this ad.`
        )
      : null,
    siblings.length
      ? section(
          "## SIBLING ADS ALREADY DIRECTED IN THIS CAMPAIGN (use a different master and hero)",
          siblings
            .map((s) => `- Ad ${s.index + 1}${s.master ? ` (master ${s.master})` : ""}: ${s.concept}`)
            .join("\n")
        )
      : null,
    assignedMaster
      ? section(
          "## ASSIGNED LAYOUT MASTER",
          `Use ${assignedMaster} as the layout master of this ad (other ads of this campaign use other masters).`
        )
      : null,
    steer?.trim() ? section("## OPERATOR DIRECTION (highest priority)", steer.trim()) : null,
  ].filter(Boolean);

  return blocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// Conteúdo multimodal: referências rotuladas + fotos + texto
// ---------------------------------------------------------------------------

async function buildContent(
  input: ArtDirectionInput
): Promise<{ content: Anthropic.Messages.ContentBlockParam[]; sentTokens: string[] }> {
  const now = new Date();
  const entries = input.catalog.entries.slice(0, MAX_VISION_REFERENCES);
  const images = await Promise.all(entries.map((e) => urlToVisionBlock(e.asset.storageUrl)));

  const content: Anthropic.Messages.ContentBlockParam[] = [];
  const sentTokens: string[] = [];

  entries.forEach((entry, i) => {
    const image = images[i];
    if (!image) return;
    sentTokens.push(entry.token);
    const winner = entry.asset.isWinner ? ", approved past ad of this client" : "";
    content.push({
      type: "text",
      text: `${entry.token} (${entry.asset.kind}${winner}; ${describeUsage(entry.asset, now)}):`,
    });
    content.push(image);
  });

  if (input.clientPhotos.length) {
    const photos = await Promise.all(input.clientPhotos.map((p) => urlToVisionBlock(p.url, 800)));
    photos.forEach((photo, i) => {
      if (!photo) return;
      content.push({ type: "text", text: `FOTO ${i + 1} (real client photo):` });
      content.push(photo);
    });
  }

  content.push({ type: "text", text: buildUserPrompt(input) });
  return { content, sentTokens };
}

// ---------------------------------------------------------------------------
// Resolução de tokens → assets
// ---------------------------------------------------------------------------

export function resolveReferences(
  raw: ArtDirectorOutput["references"],
  input: ArtDirectionInput
): ChosenReference[] {
  const out: ChosenReference[] = [];
  const used = new Set<string>();

  for (const ref of raw) {
    const asset = input.catalog.byToken.get(ref.token.trim().toLowerCase());
    // Token inventado pelo modelo: descarta em vez de derrubar a arte inteira.
    if (!asset || used.has(asset.id)) continue;
    used.add(asset.id);

    out.push({
      assetId: asset.id,
      storageUrl: asset.storageUrl,
      // A primeira escolhida é o mestre, sempre com papel de layout.
      role: out.length === 0 ? "layout" : isReferenceKind(ref.role) ? ref.role : asset.kind,
      intent: ref.intent.trim().slice(0, 240),
    });
    if (out.length >= 3) break;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Chamada
// ---------------------------------------------------------------------------

function parseOutput(message: Anthropic.Messages.Message): ArtDirectorOutput {
  if (message.stop_reason === "refusal") {
    throw new ArtDirectionError("O modelo recusou a direção desta arte");
  }
  if (message.stop_reason === "max_tokens") {
    throw new ArtDirectionError("Direção de arte truncada (max_tokens)");
  }
  const text = message.content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text"
  )?.text;
  if (!text) throw new ArtDirectionError("Claude não devolveu a direção de arte");
  return JSON.parse(text) as ArtDirectorOutput;
}

function validate(parsed: ArtDirectorOutput): void {
  if (!parsed.brief?.trim()) throw new ArtDirectionError("Briefing vazio");
  if (!parsed.concept?.trim()) throw new ArtDirectionError("Conceito vazio");
  const words = parsed.brief.trim().split(/\s+/).length;
  if (words < 80) throw new ArtDirectionError(`Briefing curto demais (${words} palavras)`);
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError ||
    error instanceof ArtDirectionError ||
    error instanceof SyntaxError
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function directArt(input: ArtDirectionInput): Promise<ArtDirection> {
  const anthropic = getAnthropicClient();
  const model = getArtDirectorModel();
  const { content } = await buildContent(input);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: { type: "json_schema", schema: ART_DIRECTOR_OUTPUT_SCHEMA },
        },
        system: ART_DIRECTOR_SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });

      const parsed = parseOutput(response);
      validate(parsed);

      const references = resolveReferences(parsed.references ?? [], input);
      if (references.length === 0 && input.catalog.entries.length > 0) {
        throw new ArtDirectionError("Nenhuma referência válida escolhida");
      }

      return {
        concept: parsed.concept.trim(),
        prompt: parsed.brief.trim(),
        negative: (parsed.negative ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 6),
        differentiator: parsed.differentiator?.trim() ?? "",
        references,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      break;
    }
  }

  throw lastError ?? new ArtDirectionError("Falha ao gerar a direção de arte");
}
