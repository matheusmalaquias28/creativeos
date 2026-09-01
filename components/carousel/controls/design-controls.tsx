"use client";

import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ModernColorPicker } from "@/components/carousel/controls/pickers";
import type {
  CarouselBadge,
  CarouselDesign,
  CarouselNumbering,
  CarouselPagination,
  Corner,
} from "@/types/carousel";

const CORNERS: { id: Corner; label: string }[] = [
  { id: "top-left", label: "Sup. Esq." },
  { id: "top-right", label: "Sup. Dir." },
  { id: "bottom-left", label: "Inf. Esq." },
  { id: "bottom-right", label: "Inf. Dir." },
];

function CornerPicker({ value, onChange }: { value: Corner; onChange: (c: Corner) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {CORNERS.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "rounded-lg border px-2 py-1.5 text-[0.625rem] font-medium transition-colors",
            value === c.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary cursor-pointer"
      />
    </label>
  );
}

export function DesignControls({
  design,
  onChange,
}: {
  design: CarouselDesign;
  onChange: (patch: Partial<CarouselDesign>) => void;
}) {
  function patchBadge(p: Partial<CarouselBadge>) {
    onChange({ badge: { ...design.badge, ...p } });
  }
  function patchNumbering(p: Partial<CarouselNumbering>) {
    onChange({ numbering: { ...design.numbering, ...p } });
  }
  function patchPagination(p: Partial<CarouselPagination>) {
    onChange({ pagination: { ...design.pagination, ...p } });
  }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo muito grande (máx 5 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => patchBadge({ logoUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      {/* Badge */}
      <div className="space-y-3">
        <ToggleRow label="Badge (logo + @)" checked={design.badge.enabled} onChange={(v) => patchBadge({ enabled: v })} />
        {design.badge.enabled && (
          <div className="space-y-3 pl-1">
            <label
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-xs transition-colors",
                design.badge.logoUrl
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <input type="file" accept="image/*" className="sr-only" onChange={handleLogo} />
              <ImagePlus className="size-3.5" />
              {design.badge.logoUrl ? "Trocar logo" : "Carregar logo (PNG/JPG)"}
            </label>
            {design.badge.logoUrl && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={design.badge.logoUrl} alt="logo" className="h-8 w-auto max-w-[120px] object-contain" />
                <button
                  onClick={() => patchBadge({ logoUrl: null })}
                  className="text-[0.625rem] text-negative hover:underline"
                >
                  Remover
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[0.625rem] text-muted-foreground/70">@ do Instagram</label>
              <Input
                value={design.badge.handle}
                onChange={(e) => patchBadge({ handle: e.target.value })}
                placeholder="@suamarca"
                className="h-8 text-xs"
              />
            </div>
            <p className="text-[0.5625rem] leading-relaxed text-muted-foreground/50">
              O badge aparece somente no primeiro card e acompanha a posição do texto dele (seção Texto).
            </p>
          </div>
        )}
      </div>

      {/* Numbering */}
      <div className="space-y-3 border-t border-white/6 pt-4">
        <ToggleRow label="Numeração dos slides" checked={design.numbering.enabled} onChange={(v) => patchNumbering({ enabled: v })} />
        {design.numbering.enabled && (
          <div className="space-y-1.5 pl-1">
            <label className="text-[0.625rem] text-muted-foreground/70">Posição</label>
            <CornerPicker value={design.numbering.position} onChange={(c) => patchNumbering({ position: c })} />
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="space-y-3 border-t border-white/6 pt-4">
        <ToggleRow label="Botão de paginação" checked={design.pagination.enabled} onChange={(v) => patchPagination({ enabled: v })} />
        {design.pagination.enabled && (
          <div className="space-y-3 pl-1">
            <div className="space-y-1.5">
              <label className="text-[0.625rem] text-muted-foreground/70">Lado</label>
              <div className="flex gap-1">
                {(["left", "right"] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => patchPagination({ side })}
                    className={cn(
                      "flex-1 rounded-lg border px-2 py-1.5 text-[0.625rem] font-medium transition-colors",
                      design.pagination.side === side
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    {side === "left" ? "Esquerda" : "Direita"}
                  </button>
                ))}
              </div>
            </div>
            <ModernColorPicker label="Cor da seta" value={design.pagination.color} onChange={(v) => patchPagination({ color: v })} />
          </div>
        )}
      </div>
    </div>
  );
}
