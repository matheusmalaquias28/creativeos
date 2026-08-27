"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getDemandById } from "@/services/demands";
import { getCreativeProfile } from "@/services/art-gen";
import type { VisualIdentityDna } from "@/lib/schemas/visual-identity";

export type ArtBrief = {
  arte_index: number;
  headline: string;
  conceito_visual: string;
  composicao: string;
  iluminacao: string;
  mood: string;
  estilo: string;
  prompt_magnific: string;
};

export type CreativeBriefResult =
  | { briefs: ArtBrief[] }
  | { error: string };

function buildDnaContext(dna: VisualIdentityDna): string {
  const lines: string[] = [
    `Resumo da marca: ${dna.summary}`,
    `Paleta: ${dna.palette.join(", ")}`,
    `Tipografia headline: ${dna.typography.headlineStyle}`,
    `Tipografia corpo: ${dna.typography.bodyStyle}`,
    `Composição preferida: ${dna.compositionStyle}`,
    `Mood da marca: ${dna.mood}`,
    `Palavras-chave visuais: ${dna.visualKeywords.join(", ")}`,
    `Elementos fixos da marca: ${dna.elementsToRepeat.join(", ")}`,
  ];
  if (dna.typography.notes) lines.push(`Notas tipográficas: ${dna.typography.notes}`);
  if (dna.avoid?.length) lines.push(`EVITAR: ${dna.avoid.join(", ")}`);
  return lines.join("\n");
}

export async function generateCreativeBriefAction(
  demandId: string
): Promise<CreativeBriefResult> {
  const demand = await getDemandById(demandId);
  if (!demand) return { error: "Demanda não encontrada" };
  if (!demand.client_id) return { error: "Vincule um cliente à demanda antes de gerar o brief" };

  const profile = await getCreativeProfile(demand.client_id);

  const dna = profile?.visual_identity_dna as VisualIdentityDna | null;
  const basePrompt = profile?.base_prompt ?? "";
  const palette = (profile?.palette ?? []) as string[];

  const hasIdentity = Boolean(dna || basePrompt);

  // Build identity context block
  const identityBlock = [
    basePrompt ? `Prompt base da marca:\n${basePrompt}` : "",
    dna ? `DNA visual extraído:\n${buildDnaContext(dna)}` : "",
    palette.length ? `Paleta de cores: ${palette.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Build artes block
  const artesBlock = demand.artes
    .map((arte, i) => {
      const lines = [`Arte ${i + 1}:`];
      if (arte.headline) lines.push(`  Headline: "${arte.headline}"`);
      if (arte.subheadline) lines.push(`  Subheadline: "${arte.subheadline}"`);
      if (arte.cta) lines.push(`  CTA: "${arte.cta}"`);
      if (arte.informacoesExtras) lines.push(`  Informações extras: ${arte.informacoesExtras}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const userMessage = `## Campanha
Título: ${demand.briefing.titulo || "—"}
Tipo de arte: ${(demand.tipo ?? demand.briefing.tipo) || "—"}
Instagram do cliente: ${demand.briefing.instagramCliente || "—"}

${hasIdentity ? `## Identidade Visual do Cliente\n${identityBlock}` : "## Identidade Visual\nNenhum DNA visual cadastrado — use boas práticas de design e fotografia."}

## Artes para briefar

${artesBlock}

## Tarefa
Para cada arte acima, crie um brief visual completo e um prompt pronto para o Magnific.

O "prompt_magnific" deve ser rico, cinematográfico e descritivo — como um diretor de arte briefando um fotógrafo de luxo. Deve incorporar naturalmente a identidade visual do cliente (cores, mood, composição), descrever a cena completa, o ambiente, a iluminação e a atmosfera. NÃO mencione os textos da arte no prompt_magnific — eles são adicionados separadamente.

Retorne APENAS JSON válido, sem markdown, sem explicações. Formato exato:
[{"arte_index":0,"headline":"texto da headline","conceito_visual":"...","composicao":"...","iluminacao":"...","mood":"...","estilo":"...","prompt_magnific":"..."}]`;

  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system:
      "Você é um diretor de arte sênior especializado em criativos para redes sociais e marketing de performance. Cria briefs visuais precisos e prompts otimizados para geradores de imagem IA (especialmente Magnific). Escreve em português brasileiro. Responde APENAS com JSON válido, nunca com markdown ou texto fora do JSON.",
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  let briefs: ArtBrief[];
  try {
    briefs = JSON.parse(raw);
    if (!Array.isArray(briefs)) throw new Error("Resposta não é array");
  } catch {
    return { error: "Falha ao interpretar resposta da IA. Tente novamente." };
  }

  return { briefs };
}
