/**
 * Bloco técnico determinístico anexado ao briefing aprovado.
 *
 * Divisão de responsabilidade: o diretor de arte (Claude, com visão) decide o
 * design; este bloco impõe os padrões de produto que NÃO variam entre artes:
 *
 * - a ordem e o papel das imagens enviadas (Imagem 1 = layout mestre);
 * - área segura de anúncios Meta;
 * - zona reservada da logo no topo central (a logo real é composta depois,
 *   sem fundo e com contraste — ver lib/ai/imagegen/brand-logo.ts);
 * - CTA sempre como botão centralizado na base;
 * - lista fechada de textos, com a caixa (maiúsc./minúsc.) original.
 *
 * Em inglês porque é o idioma em que o modelo de imagem segue especificação de
 * layout com mais precisão; os TEXTOS da arte continuam em português, entre aspas.
 *
 * A ordem enumerada aqui DEVE bater com a ordem das InlineDataParts montadas no
 * worker — ambas derivam da mesma lista de `art_job_reference` ordenada por
 * `position`.
 */

import { LOGO_ZONE } from "@/lib/ai/imagegen/brand-logo";
import type { ReferenceRole } from "./types";

export type TechnicalBlockRef = {
  role: ReferenceRole;
  intent: string | null;
};

export type TechnicalBlockSpec = {
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  aspectRatio?: string | null;
  imageSize?: string | null;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Faixa reservada para a logo, em % da altura (com folga abaixo da logo). */
export const LOGO_ZONE_BAND = {
  from: 0.04,
  to: LOGO_ZONE.top + LOGO_ZONE.maxHeight + 0.02,
} as const;

/** Onde o topo do conteúdo pode começar — logo abaixo da zona da logo. */
export const CONTENT_TOP = LOGO_ZONE_BAND.to + 0.02;

/** Base do botão de CTA (fração da altura). Dentro do corte 4:5 do feed. */
export const CTA_BOTTOM = 0.89;

function roleSentence(ref: TechnicalBlockRef, index: number, masterIndex: number): string {
  const intent = ref.intent?.trim();
  if (ref.role === "personagem") {
    return `is a real photo of the client — this exact person appears in the ad; never alter face, body, age or identity.${intent ? ` ${intent}` : ""}`;
  }
  if (index === masterIndex) {
    return (
      "is the LAYOUT & TYPOGRAPHY MASTER: recreate its design language — grid, alignment, " +
      "type pairing and scale contrast, emphasis treatment, graphic devices and finishing — " +
      "for the new content. Never copy its words, logo or brand." +
      (intent ? ` Focus: ${intent}` : "")
    );
  }
  return `is a supporting reference (${ref.role}) — use it only for: ${intent || "mood and finishing"}.`;
}

export function buildReferenceBlock(refs: TechnicalBlockRef[]): string {
  const usable = refs.filter((r) => r.role !== "logo");
  if (usable.length === 0) return "";

  // O mestre é a primeira referência de estilo/layout (fotos do cliente vêm antes).
  const masterIndex = usable.findIndex((r) => r.role !== "personagem");
  const lines = usable.map(
    (ref, i) => `- Image ${i + 1} ${roleSentence(ref, i, masterIndex)}`
  );
  return ["REFERENCE IMAGES, in order:", ...lines].join("\n");
}

export function buildTextBlock(spec: TechnicalBlockSpec): string {
  const strings: string[] = [];
  if (spec.headline) strings.push(`  • "${spec.headline}"`);
  if (spec.subheadline) strings.push(`  • "${spec.subheadline}"`);
  if (spec.informacoesExtras) strings.push(`  • "${spec.informacoesExtras}"`);
  if (spec.cta) strings.push(`  • "${spec.cta}" (button)`);

  if (strings.length === 0) {
    return "- TEXT: the ad carries NO text at all. The visual composition is still mandatory.";
  }

  return [
    "- TEXT: render ONLY these strings, exactly as written — same letter case (never convert to ALL CAPS unless already written so), correct Brazilian Portuguese accents and punctuation — and nothing else:",
    ...strings,
    "  No other words anywhere: no invented phrases, prices, dates, seals, signatures or watermarks. The only allowed extra is one oversized decorative echo of a single word taken from the headline, if the layout calls for it.",
    "  Props carry no readable text and never any English words: documents and papers have NO title or heading (never \"CONTRACT\", \"CONTRATO\" or similar) — only soft grey illegible lines; screens and signs are blank or blurred; vehicles and products show no brand badges.",
  ].join("\n");
}

export function buildStandardsBlock(spec: TechnicalBlockSpec): string {
  const lines = [
    "PRODUCTION STANDARDS — NON-NEGOTIABLE",
    `- Canvas: ${spec.aspectRatio ?? "3:4"} portrait feed ad for Instagram/Facebook (Meta). Safe area: every text element and the button stay inside the central area, at least 7% from the left and right edges, 6% from the top and 9% from the bottom.`,
    `- RESERVED LOGO ZONE: the top-centre band from 0% to ${pct(LOGO_ZONE_BAND.to)} of the height, across the middle 60% of the width, is ONE uniform, calm background area — the same flat colour or softly blurred tone all across, with no edges, colour blocks, photo borders, paper edges, tape, objects or text crossing it. It must be a seamless continuation of the main background (e.g. the dark top of the scene or a soft vignette), never a separate hard-edged header bar. The headline or any other element starts below ${pct(CONTENT_TOP)} of the height. Do NOT draw any logo, monogram, brand name or watermark anywhere.`,
  ];
  if (spec.cta) {
    lines.push(
      `- BUTTON: render "${spec.cta}" as a refined button (filled or outlined, generous padding), horizontally centred, its bottom edge at about ${pct(CTA_BOTTOM)} of the canvas height. It must read unmistakably as a tappable button.`
    );
  }
  lines.push(buildTextBlock(spec));
  lines.push(
    "- Finish: typeset like a senior designer — consistent baselines, optical kerning, no distorted, merged or duplicated glyphs — with print-quality detail and cohesive colour grading."
  );
  return lines.join("\n");
}

/**
 * O modelo de imagem imprime no papel o tipo de documento que o briefing cita
 * ("contract" → "CONTRACT" escrito na folha). Rede de segurança determinística
 * para a instrução equivalente do system prompt do diretor.
 */
export function sanitizeBrief(brief: string): string {
  return brief
    .replace(/\bcontracts\b/gi, "printed pages")
    .replace(/\bcontract\b/gi, "printed pages");
}

/**
 * Concatena o briefing escrito (ou editado pelo operador) com o bloco técnico.
 * O briefing vem depois das referências e antes dos padrões: é o que carrega o
 * design; os padrões fecham o prompt porque são o que não pode ser violado.
 */
export function appendTechnicalBlock(
  approvedPrompt: string,
  spec: TechnicalBlockSpec,
  refs: TechnicalBlockRef[],
  fixNotes?: string[]
): string {
  const parts: string[] = [];

  const refBlock = buildReferenceBlock(refs);
  if (refBlock) parts.push(refBlock);

  parts.push(sanitizeBrief(approvedPrompt.trim()));
  parts.push(buildStandardsBlock(spec));

  if (fixNotes?.length) {
    parts.push(
      [
        "A PREVIOUS ATTEMPT FAILED REVIEW. Fix all of these in this version:",
        ...fixNotes.map((n) => `- ${n}`),
      ].join("\n")
    );
  }

  return parts.filter(Boolean).join("\n\n");
}
