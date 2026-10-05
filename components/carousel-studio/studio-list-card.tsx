import Link from "next/link";
import { GalleryHorizontalEnd, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isStudioBusy } from "@/types/carousel-studio";
import type { StudioCarouselListItem } from "@/services/carousel-studio";

const STATUS: Record<StudioCarouselListItem["status"], { label: string; cls: string }> = {
  idle: { label: "Não gerado", cls: "bg-muted text-muted-foreground" },
  queued: { label: "Na fila", cls: "bg-tone-amber/15 text-tone-amber" },
  generating: { label: "Gerando", cls: "bg-tone-amber/15 text-tone-amber" },
  ready: { label: "Pronto", cls: "bg-tone-green/15 text-tone-green" },
  failed: { label: "Falhou", cls: "bg-tone-red/15 text-tone-red" },
};

export function StudioListCard({ item }: { item: StudioCarouselListItem }) {
  const status = STATUS[item.status];
  const aspect = item.format === "1:1" ? "aspect-square" : item.format === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]";
  return (
    <Link
      href={`/carousel/studio/${item.id}`}
      className="group overflow-hidden rounded-2xl border border-border bg-card transition-premium hover:border-border-strong hover-lift"
    >
      <div className={cn("relative overflow-hidden bg-muted", aspect)}>
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail_url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {isStudioBusy(item.status) ? <Loader2 className="size-6 animate-spin" /> : <GalleryHorizontalEnd className="size-6" />}
          </div>
        )}
        <span className={cn("absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur", status.cls)}>
          {status.label}
        </span>
      </div>
      <div className="space-y-0.5 p-3">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[item.client_name, item.page_count ? `${item.page_count} páginas` : null].filter(Boolean).join(" · ") || "Studio"}
        </p>
      </div>
    </Link>
  );
}
