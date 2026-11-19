/**
 * Partes puras do formato studio (testadas): cards do agente → artes do
 * briefing do Studio, e textos de uma página para a aba de aprovação.
 */

import type { DemandArte } from "@/types/demand";
import type { StudioPage } from "@/types/carousel-studio";
import type { AgentStudioCard } from "./types";

/** Card do agente → arte do briefing que o diretor do Studio entende (puro, testado). */
export function studioCardsToArtes(cards: AgentStudioCard[]): DemandArte[] {
  return cards.map((card, i) => {
    const lines = card.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const last = i === cards.length - 1;
    // Último card com 3+ linhas: a última é o CTA (mesma regra do playbook).
    const cta = card.cta?.trim() || (last && lines.length >= 3 ? lines.pop()! : "");
    const [headline = "", ...rest] = lines;
    const notes = [card.template ? `Use o modelo ${card.template}.` : "", card.visual?.trim() ?? ""].filter(Boolean);
    return {
      headline,
      subheadline: rest.join("\n"),
      cta,
      informacoesExtras: "",
      observacaoVisual: notes.join(" "),
      linkReferencias: "",
      imagensReferencias: [],
    };
  });
}

/** Textos visíveis de uma página, na ordem de leitura (para a aba e a revisão). */
export function pageTexts(page: StudioPage): { texts: string[]; cta: string | null } {
  const layers = page.layers.filter((l) => !l.hidden && (l.type === "text" || l.type === "button"));
  layers.sort((a, b) => a.y - b.y || a.x - b.x);
  const texts: string[] = [];
  let cta: string | null = null;
  for (const l of layers) {
    if (l.type === "button") cta ??= l.text;
    else if (l.type === "text" && l.text.trim()) texts.push(l.text.replace(/\*/g, ""));
  }
  return { texts, cta };
}
