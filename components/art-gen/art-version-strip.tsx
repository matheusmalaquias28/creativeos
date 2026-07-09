"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ArtVersion } from "@/services/art-gen";

type Props = {
  versions: ArtVersion[];
  currentVersionId: string | null;
  onSelect: (version: ArtVersion) => void;
};

/** Miniaturas horizontais das versões (máx 4 mais recentes). */
export function ArtVersionStrip({ versions, currentVersionId, onSelect }: Props) {
  const recent = versions.slice(0, 4);

  if (recent.length <= 1) return null;

  return (
    <div className="flex gap-2">
      {recent.map((v) => {
        const isCurrent = v.id === currentVersionId;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            title={v.instruction ? `v${v.version_number}: ${v.instruction}` : `v${v.version_number} (original)`}
            className={cn(
              "relative size-14 overflow-hidden rounded-lg border-2 transition-all hover:scale-105",
              isCurrent
                ? "border-primary shadow-md"
                : "border-border opacity-60 hover:opacity-100"
            )}
          >
            <Image
              src={v.result_url}
              alt={`Versão ${v.version_number}`}
              fill
              unoptimized
              className="object-cover"
              sizes="56px"
            />
            <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[9px] text-white">
              v{v.version_number}
            </span>
            {isCurrent && (
              <span className="absolute left-0 top-0 rounded-br bg-primary px-1 text-[9px] text-primary-foreground">
                atual
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
