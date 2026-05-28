"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { normalizeHexColor, isValidHexColor } from "@/lib/utils/color";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_COLORS = 5;
const DEFAULT_PICK = "#6366F1";

type BrandColorPickerProps = {
  value: string[];
  onChange: (colors: string[]) => void;
  error?: string;
};

export function BrandColorPicker({
  value,
  onChange,
  error,
}: BrandColorPickerProps) {
  const [hexInput, setHexInput] = useState(DEFAULT_PICK);
  const [inputError, setInputError] = useState<string | null>(null);

  const addColor = () => {
    if (value.length >= MAX_COLORS) {
      setInputError(`Máximo de ${MAX_COLORS} cores`);
      return;
    }
    const normalized = normalizeHexColor(hexInput);
    if (!normalized) {
      setInputError("Hex inválido. Ex: #1A2B3C");
      return;
    }
    if (value.includes(normalized)) {
      setInputError("Cor já adicionada");
      return;
    }
    setInputError(null);
    onChange([...value, normalized]);
  };

  const removeColor = (hex: string) => {
    onChange(value.filter((c) => c !== hex));
    setInputError(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>
          Cores da identidade visual
          <span className="ml-1 text-destructive">*</span>
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Selecione até {MAX_COLORS} cores em hex — paleta principal do cliente
        </p>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((hex) => (
            <div
              key={hex}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 py-1.5 pr-2 pl-1.5"
            >
              <span
                className="size-8 shrink-0 rounded-md border border-border/40"
                style={{ backgroundColor: hex }}
                title={hex}
              />
              <span className="font-mono text-xs text-foreground/90">{hex}</span>
              <button
                type="button"
                onClick={() => removeColor(hex)}
                className="rounded-md p-1 text-muted-foreground transition-premium hover:bg-muted/50 hover:text-foreground"
                aria-label={`Remover ${hex}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length < MAX_COLORS && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={
                isValidHexColor(hexInput)
                  ? (normalizeHexColor(hexInput) ?? DEFAULT_PICK).toLowerCase()
                  : DEFAULT_PICK
              }
              onChange={(e) => {
                setHexInput(e.target.value.toUpperCase());
                setInputError(null);
              }}
              className="size-10 cursor-pointer rounded-lg border border-border/50 bg-transparent p-0.5"
              aria-label="Seletor de cor"
            />
            <Input
              value={hexInput}
              onChange={(e) => {
                setHexInput(e.target.value);
                setInputError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addColor();
                }
              }}
              placeholder="#000000"
              className="w-28 font-mono text-sm uppercase"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addColor}>
            <Plus className="size-4" />
            Adicionar cor
          </Button>
          <span className="text-xs text-muted-foreground">
            {value.length}/{MAX_COLORS}
          </span>
        </div>
      )}

      {(inputError || error) && (
        <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? inputError}
        </p>
      )}
    </div>
  );
}
