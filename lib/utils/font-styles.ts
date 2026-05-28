import { FONT_STYLE_PRESETS } from "@/lib/constants/font-styles";

export function splitFontStyles(saved?: string): {
  presetIds: string[];
  notes: string;
} {
  if (!saved?.trim()) return { presetIds: [], notes: "" };

  const presetIds = FONT_STYLE_PRESETS.filter((p) =>
    saved.includes(p.label)
  ).map((p) => p.id);

  let notes = saved;
  for (const preset of FONT_STYLE_PRESETS) {
    notes = notes.split(preset.label).join("");
  }
  notes = notes.replace(/·/g, " ").replace(/\s+/g, " ").trim();

  return { presetIds, notes };
}
