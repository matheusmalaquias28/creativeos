/**
 * A chamada de direção de arte.
 *
 * Uma chamada por arte, saída estruturada via tool use (não parsing de JSON
 * solto). Uma chamada e não duas — quem escolhe a referência precisa ser quem
 * escreve a cena, senão prompt e referências brigam.
 *
 * Modelo: Sonnet por padrão. Haiku está certo para anotar referência e extrair
 * DNA (tarefas de descrição); direção de arte é julgamento composicional e Haiku
 * volta a produzir a média — que é o problema que a camada existe para resolver.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  ART_DIRECTOR_SYSTEM_PROMPT,
  ART_DIRECTOR_TOOL,
  type ArtDirectorToolInput,
} from "./system-prompt";
import { isReferenceKind } from "./types";
import type { ArtDirection, ArtDirectionInput, ChosenReference } from "./types";

const MAX_TOKENS = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 400;

export function getArtDirectorModel(): string {
  return process.env.ART_DIRECTOR_MODEL?.trim() || "claude-sonnet-4-5-20250929";
}

export class ArtDirectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtDirectionError";
  }
}

// ---------------------------------------------------------------------------
// Prompt do usuário
// ---------------------------------------------------------------------------

function section(title: string, body: string | null | undefined): string | null {
  const value = body?.toString().trim();
  return value ? `${title}\n${value}` : null;
}

export function buildUserPrompt(input: ArtDirectionInput): string {
  const { client, catalog, demand, art, siblings, steer, clientPhotos } = input;

  const dna = client.dna
    ? [
        `Resumo: ${client.dna.summary}`,
        `Composição: ${client.dna.compositionStyle}`,
        `Tipografia: ${client.dna.typography.headlineStyle} / ${client.dna.typography.bodyStyle}`,
        `Mood: ${client.dna.mood}`,
        `Palavras-chave: ${client.dna.visualKeywords.join(", ")}`,
        `Elementos recorrentes: ${client.dna.elementsToRepeat.join(", ")}`,
        client.dna.avoid?.length ? `Evitar: ${client.dna.avoid.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const copy = [
    art.headline ? `Headline: "${art.headline}"` : null,
    art.subheadline ? `Subheadline: "${art.subheadline}"` : null,
    art.cta ? `CTA: "${art.cta}"` : null,
    art.informacoesExtras ? `Informações extras: ${art.informacoesExtras}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const blocks = [
    section("## CLIENTE", client.name),
    section("## DNA VISUAL DO CLIENTE", dna),
    section("## PALETA DA MARCA", client.palette.join(", ")),
    section("## IDENTIDADE (prompt base salvo)", client.basePrompt),
    client.directionNotes.length
      ? section(
          "## REGRAS APRENDIDAS DESTE CLIENTE (respeite todas)",
          client.directionNotes.map((n) => `- ${n.note}`).join("\n")
        )
      : null,
    section(
      "## DEMANDA",
      [
        demand.titulo ? `Campanha: ${demand.titulo}` : null,
        demand.tipo ? `Tipo: ${demand.tipo}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    ),
    section("## COPY DESTA ARTE (arte " + (art.index + 1) + ")", copy || "(sem copy)"),
    section("## FORMATO", `${art.aspectRatio}, ${art.imageSize}`),
    section("## CATÁLOGO DE REFERÊNCIAS DO CLIENTE", catalog.text),
    clientPhotos.length
      ? section(
          "## FOTO REAL DO CLIENTE",
          `${clientPhotos.length} foto(s) real(is) do cliente serão enviadas junto com as referências. ` +
            "Esta é a pessoa que aparece na arte: descreva o enquadramento, a luz e a situação dela na cena, " +
            "sem alterar rosto, corpo, idade ou identidade."
        )
      : null,
    siblings.length
      ? section(
          "## CONCEITOS JÁ ESCRITOS NESTA DEMANDA (diferencie-se deles)",
          siblings.map((s) => `- Arte ${s.index + 1}: ${s.concept}`).join("\n")
        )
      : null,
    steer?.trim()
      ? section("## DIREÇÃO DO OPERADOR (prioridade máxima)", steer.trim())
      : null,
  ].filter(Boolean);

  return blocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// Resolução de tokens → assets
// ---------------------------------------------------------------------------

export function resolveReferences(
  raw: ArtDirectorToolInput["references"],
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
      role: isReferenceKind(ref.role) ? ref.role : asset.kind,
      intent: ref.intent.trim().slice(0, 200),
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Chamada
// ---------------------------------------------------------------------------

function extractToolInput(
  content: Anthropic.Messages.Message["content"]
): ArtDirectorToolInput {
  const block = content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === ART_DIRECTOR_TOOL.name
  );
  if (!block) {
    throw new ArtDirectionError("Claude não devolveu a direção de arte estruturada");
  }
  return block.input as ArtDirectorToolInput;
}

function validate(parsed: ArtDirectorToolInput): void {
  if (!parsed.prompt?.trim()) throw new ArtDirectionError("Prompt vazio");
  if (!parsed.concept?.trim()) throw new ArtDirectionError("Conceito vazio");

  const words = parsed.prompt.trim().split(/\s+/).length;
  if (words < 60) {
    throw new ArtDirectionError(`Prompt curto demais (${words} palavras)`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function directArt(input: ArtDirectionInput): Promise<ArtDirection> {
  const anthropic = getAnthropicClient();
  const model = getArtDirectorModel();
  const userPrompt = buildUserPrompt(input);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        // Alta o bastante para variar entre artes irmãs, baixa o bastante para
        // não ignorar as regras do cliente.
        temperature: 0.9,
        system: ART_DIRECTOR_SYSTEM_PROMPT,
        tools: [ART_DIRECTOR_TOOL],
        tool_choice: { type: "tool", name: ART_DIRECTOR_TOOL.name },
        messages: [{ role: "user", content: userPrompt }],
      });

      const parsed = extractToolInput(response.content);
      validate(parsed);

      const references = resolveReferences(parsed.references ?? [], input);
      if (references.length === 0 && input.catalog.entries.length > 0) {
        throw new ArtDirectionError("Nenhuma referência válida escolhida");
      }

      return {
        concept: parsed.concept.trim(),
        prompt: parsed.prompt.trim(),
        negative: (parsed.negative ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 8),
        differentiator: parsed.differentiator?.trim() ?? "",
        references,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError ?? new ArtDirectionError("Falha ao gerar a direção de arte");
}
