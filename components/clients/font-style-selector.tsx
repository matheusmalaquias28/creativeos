"use client";

import { FONT_STYLE_PRESETS } from "@/lib/constants/font-styles";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FontStyleSelectorProps = {
  selectedPresets: string[];
  customNotes: string;
  onPresetsChange: (presets: string[]) => void;
  onCustomNotesChange: (notes: string) => void;
  composedValue: string;
  onComposedChange: (value: string) => void;
  error?: string;
};

function buildFontStylesValue(presets: string[], customNotes: string): string {
  const presetLabels = presets
    .map((id) => FONT_STYLE_PRESETS.find((p) => p.id === id)?.label)
    .filter(Boolean) as string[];

  const parts = [...presetLabels];
  const notes = customNotes.trim();
  if (notes) parts.push(notes);

  return parts.join(" · ");
}

export function FontStyleSelector({
  selectedPresets,
  customNotes,
  onPresetsChange,
  onCustomNotesChange,
  composedValue,
  onComposedChange,
  error,
}: FontStyleSelectorProps) {
  const togglePreset = (id: string) => {
    const next = selectedPresets.includes(id)
      ? selectedPresets.filter((p) => p !== id)
      : [...selectedPresets, id];
    onPresetsChange(next);
    onComposedChange(buildFontStylesValue(next, customNotes));
  };

  const handleNotesChange = (notes: string) => {
    onCustomNotesChange(notes);
    onComposedChange(buildFontStylesValue(selectedPresets, notes));
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>
          Estilos de fonte
          <span className="ml-1 text-destructive">*</span>
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Selecione um ou mais estilos e complemente com observações se necessário
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FONT_STYLE_PRESETS.map((preset) => {
          const active = selectedPresets.includes(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => togglePreset(preset.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-premium",
                active
                  ? "border-foreground/30 bg-muted/50"
                  : "border-border/50 bg-card/30 hover:border-border/70"
              )}
            >
              <span className="block text-xs font-medium text-foreground">
                {preset.label}
              </span>
              <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>

      <Textarea
        value={customNotes}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder="Opcional — fontes específicas, pesos, hierarquia tipográfica..."
        rows={2}
      />

      <input type="hidden" name="fontStyles" value={composedValue} readOnly />

      {composedValue && (
        <p className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground">
          {composedValue}
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
