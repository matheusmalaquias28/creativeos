import type { DemandArte } from "@/types/demand";

function appendLine(
  lines: string[],
  label: string,
  value: string | null | undefined
) {
  if (!value) return;
  lines.push(`${label}: ${value}`);
}

export function formatArteTexts(arte: DemandArte): string {
  const lines: string[] = [];

  appendLine(lines, "Headline", arte.headline);
  appendLine(lines, "Subheadline", arte.subheadline);
  appendLine(lines, "Informações extras", arte.informacoesExtras);
  appendLine(lines, "CTA", arte.cta);
  appendLine(lines, "Link de referências", arte.linkReferencias);

  return lines.join("\n").trim();
}
