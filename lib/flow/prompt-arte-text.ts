import type { PromptArteData } from "@/lib/flow/types";

export function formatPromptArteData(d: PromptArteData): string {
  const lines: string[] = [];
  if (d.headline) lines.push(`Headline: ${d.headline}`);
  if (d.subheadline) lines.push(`Subheadline: ${d.subheadline}`);
  if (d.cta) lines.push(`CTA: ${d.cta}`);
  if (d.informacoesExtras) lines.push(`Extras: ${d.informacoesExtras}`);
  return lines.join("\n");
}

export function getPromptArteEditorText(d: PromptArteData): string {
  if (typeof d.promptText === "string") return d.promptText;
  return formatPromptArteData(d);
}

export function parsePromptArteText(
  text: string,
  artIndex: number,
  previous?: PromptArteData
): PromptArteData {
  const result: PromptArteData = {
    artIndex,
    headline: previous?.headline ?? null,
    subheadline: previous?.subheadline ?? null,
    cta: previous?.cta ?? null,
    informacoesExtras: previous?.informacoesExtras ?? null,
    promptText: text,
  };

  let matchedLabel = false;
  for (const line of text.split("\n")) {
    const m = line.match(/^(Headline|Subheadline|CTA|Extras):\s*(.*)$/i);
    if (!m) continue;
    matchedLabel = true;
    const val = m[2].trim() || null;
    const key = m[1].toLowerCase();
    if (key === "headline") result.headline = val;
    else if (key === "subheadline") result.subheadline = val;
    else if (key === "cta") result.cta = val;
    else if (key === "extras") result.informacoesExtras = val;
  }

  if (!matchedLabel && text.trim()) {
    result.informacoesExtras = text.trim();
    result.headline = null;
    result.subheadline = null;
    result.cta = null;
  }

  return result;
}

export function resolvePromptArteFields(data: PromptArteData): PromptArteData {
  const text = getPromptArteEditorText(data);
  return parsePromptArteText(text, data.artIndex, data);
}
