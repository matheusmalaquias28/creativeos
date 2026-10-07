/**
 * Revisão automática da arte gerada (controle de qualidade com visão).
 *
 * O modelo de imagem erra de formas previsíveis: escreve palavras que não estão
 * na copy ("CONTRACT" num papel), muda a caixa do CTA, invade a zona da logo,
 * desenha uma logo inventada, entrega um layout pobre. Instrução no prompt reduz,
 * não elimina. Esta revisão lê a arte FINAL (já com a logo composta) e, se
 * reprovar, devolve correções objetivas para UMA nova tentativa no worker.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/client";
import { getArtDirectorModel } from "./direct-art";
import { bufferToVisionBlock } from "./vision";
import { CONTENT_TOP, LOGO_ZONE_BAND, type TechnicalBlockSpec } from "./technical-block";

export type ArtReview = {
  pass: boolean;
  /** 1–10: acabamento e nível de agência. */
  score: number;
  /** Correções objetivas, em inglês, prontas para anexar ao prompt. */
  fixes: string[];
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    text_exact: { type: "boolean" },
    extra_text: { type: "array", items: { type: "string" } },
    logo_present: { type: "boolean" },
    logo_zone_clean: { type: "boolean" },
    cta_ok: { type: "boolean" },
    drawn_logo_or_brand: { type: "boolean" },
    garbled_glyphs: { type: "boolean" },
    score: { type: "integer" },
    fixes: { type: "array", items: { type: "string" } },
  },
  required: [
    "text_exact",
    "extra_text",
    "logo_present",
    "logo_zone_clean",
    "cta_ok",
    "drawn_logo_or_brand",
    "garbled_glyphs",
    "score",
    "fixes",
  ],
  additionalProperties: false,
} as const;

type ReviewOutput = {
  text_exact: boolean;
  extra_text: string[];
  logo_present: boolean;
  logo_zone_clean: boolean;
  cta_ok: boolean;
  drawn_logo_or_brand: boolean;
  garbled_glyphs: boolean;
  score: number;
  fixes: string[];
};

/** Nota mínima de acabamento para aprovar sem nova tentativa. */
export const MIN_REVIEW_SCORE = 7;

function reviewPrompt(spec: TechnicalBlockSpec): string {
  const allowed = [spec.headline, spec.subheadline, spec.informacoesExtras, spec.cta]
    .filter(Boolean)
    .map((t) => `"${t}"`)
    .join(", ");
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return `You are the QA lead of a design agency. Review this finished Instagram/Facebook ad before it goes to the client. The client's real logo is expected at the top centre. Verify that a visible, legible logo is actually present; do not assume compositing succeeded. The real composited logo is allowed.

Allowed text (exact strings, exact letter case): ${allowed || "none"}.

Check execution of hierarchy, typography and spacing as well as technical defects. Intentional negative space is not a defect. Do not enforce a single aesthetic or layout.

Check:
- text_exact: every allowed string appears exactly (same words, accents, letter case). Line breaks and emphasis styling are fine.
- extra_text: list only READABLE words that are not in the allowed strings (e.g. "CONTRACT" on a paper, a word on a screen or sign, an invented phrase, a watermark). NOT extra text: the composited logo at the top; soft illegible lines on papers.
- logo_present: true only if an actual visible, legible logo is present at the top centre. An empty reserved band is false.
- logo_zone_clean: false if the composited logo is not fully legible on ONE uniform background — e.g. it straddles an edge between two colour areas or a photo border, or text/objects collide with or crowd it (band ${pct(LOGO_ZONE_BAND.from)}–${pct(LOGO_ZONE_BAND.to)} of the height at the centre). Text starting at ~${pct(CONTENT_TOP)} is fine.
- cta_ok: ${spec.cta ? `"${spec.cta}" is legible as a clear button, follows the layout grid, and has breathing room inside safe margins. Any alignment or position is acceptable; fail only if missing, unreadable, crowded or clipped` : "true when no CTA was requested"}.
- drawn_logo_or_brand: the image model drew some OTHER logo, monogram, brand name or car/product badge.
- garbled_glyphs: clearly distorted, merged or duplicated letters in the ad's text.
- score: 1–10 for finish. Assess distinct headline/support/CTA hierarchy, legibility at phone size, coherent type pairing, line spacing, alignment, negative space and purposeful imagery. Penalize cramped type, competing focal points and decorative clutter. 7 = publishable, 9 = excellent.
- fixes: one short, objective correction in English per defect found above (empty if none). Give concrete layout or type corrections for execution defects; preserve intentional negative space.`;
}

/**
 * Revisão do Space: o prompt do node é a ÚNICA fonte da verdade. Nada de copy
 * vinda de campos parseados/briefing (que podem estar velhos) nem de regra de
 * layout fixa (logo no topo centro, logo composta) — tudo sai do prompt.
 */
function masterReviewPrompt(masterPrompt: string): string {
  return `You are the QA lead of a design agency. Review this finished Instagram/Facebook ad before it goes to the client.

The ad was generated from the operator's prompt below. That prompt is the SINGLE source of truth: the copy the ad must show, its layout, colours, CTA style and logo placement are whatever the prompt says. Never require anything that is not in it or that contradicts it.

<operator_prompt>
${masterPrompt}
</operator_prompt>

Check execution of hierarchy, typography and spacing as well as technical defects. Intentional negative space is not a defect. Do not enforce a single aesthetic or layout.

Check:
- text_exact: every piece of copy the prompt asks to display (headline, subheadline, CTA and any other quoted/labelled copy) appears exactly (same words, accents, letter case). Labels like "Headline:", "CTA ...:" and layout/colour/position instructions in the prompt are NOT copy. Line breaks and emphasis styling are fine.
- extra_text: list only READABLE words that are not part of that copy (e.g. "CONTRACT" on a paper, a word on a screen or sign, an invented phrase, a watermark). NOT extra text: the client's logo; soft illegible lines on papers.
- logo_present: if the prompt asks for the logo, true only if a visible, legible logo is present where the prompt places it. If the prompt does not ask for a logo, true.
- logo_zone_clean: false only if text or objects collide with, cover or crowd the logo so it is not fully legible. True when there is no logo.
- cta_ok: if the prompt asks for a CTA, it is legible, styled and placed as the prompt says, inside safe margins, not crowded or clipped. True when the prompt asks for no CTA.
- drawn_logo_or_brand: the image model drew some OTHER logo, monogram, brand name or car/product badge.
- garbled_glyphs: clearly distorted, merged or duplicated letters in the ad's text.
- score: 1–10 for finish. Assess distinct headline/support/CTA hierarchy, legibility at phone size, coherent type pairing, line spacing, alignment, negative space and purposeful imagery. Penalize cramped type, competing focal points and decorative clutter. 7 = publishable, 9 = excellent.
- fixes: one short, objective correction in English per defect found above (empty if none). Every fix must agree with the operator's prompt; never ask to change copy, colours or positions the prompt defines.`;
}

export function buildReviewPrompt(spec: TechnicalBlockSpec, masterPrompt?: string | null): string {
  return masterPrompt?.trim() ? masterReviewPrompt(masterPrompt.trim()) : reviewPrompt(spec);
}

export async function reviewArt(params: {
  image: Buffer;
  spec: TechnicalBlockSpec;
  /** Space: prompt do node (master). Quando presente, a revisão julga só por ele. */
  masterPrompt?: string | null;
}): Promise<ArtReview> {
  const anthropic = getAnthropicClient();
  const image = await bufferToVisionBlock(params.image, 1200);

  const response = await anthropic.messages.create({
    model: getArtDirectorModel(),
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: REVIEW_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [image, { type: "text", text: buildReviewPrompt(params.spec, params.masterPrompt) }],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    // Revisão é um filtro de qualidade, não um portão de segurança: sem
    // veredito, a arte segue e o operador julga na curadoria.
    return { pass: true, score: 0, fixes: [] };
  }

  const text = response.content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text"
  )?.text;
  if (!text) return { pass: true, score: 0, fixes: [] };

  const out = JSON.parse(text) as ReviewOutput;
  const fixes = [...(out.fixes ?? [])];
  if (!out.logo_present) {
    fixes.push(
      params.masterPrompt?.trim()
        ? "The client logo the prompt asks for is missing or illegible. Reproduce the attached logo faithfully, exactly where the prompt places it."
        : "The final composited logo is missing or illegible. Check the logo asset and compositing; do not ask the image model to invent one."
    );
  }
  if (out.extra_text?.length) {
    fixes.push(`Remove these words that must not appear: ${out.extra_text.map((t) => `"${t}"`).join(", ")}.`);
  }

  const pass =
    out.text_exact &&
    (out.extra_text?.length ?? 0) === 0 &&
    out.logo_present &&
    out.logo_zone_clean &&
    out.cta_ok &&
    !out.drawn_logo_or_brand &&
    !out.garbled_glyphs &&
    out.score >= MIN_REVIEW_SCORE;

  return { pass, score: out.score, fixes: pass ? [] : Array.from(new Set(fixes)) };
}
