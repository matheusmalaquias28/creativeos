"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquareText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/components/carousel/carousel-card";
import { TweetCardPreview } from "@/components/carousel/tweet/tweet-card-canvas";
import { deleteTweetCarouselAction } from "@/actions/tweet-carousels";
import { makeTweetCard, type TweetCarousel } from "@/types/tweet-carousel";

export function TweetCarouselCard({ carousel }: { carousel: TweetCarousel }) {
  const [deleting, setDeleting] = useState(false);
  const href = `/carousel/tweet/${carousel.id}`;
  const first = carousel.cards[0] ?? makeTweetCard();

  async function handleDelete() {
    if (!confirm(`Deletar "${carousel.name}"?`)) return;
    setDeleting(true);
    const result = await deleteTweetCarouselAction(carousel.id);
    if (result.error) {
      toast.error(result.error);
      setDeleting(false);
    } else {
      toast.success("Carrossel deletado");
    }
  }

  return (
    <div
      className={cn(
        "surface-panel hover-lift group relative flex flex-col overflow-hidden p-2",
        deleting && "pointer-events-none opacity-50"
      )}
    >
      <Link href={href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <div className="pointer-events-none overflow-hidden rounded-xl ring-1 ring-inset ring-border">
          <TweetCardPreview card={first} profile={carousel.profile} theme={carousel.theme} />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-2 pt-3 pb-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={href}>
              <p className="truncate text-sm font-bold tracking-tight text-foreground transition-colors hover:text-primary">
                {carousel.name}
              </p>
            </Link>
            <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
              {carousel.cards.length} card{carousel.cards.length !== 1 ? "s" : ""} ·{" "}
              {formatRelativeDate(carousel.updated_at)}
            </p>
          </div>
          <Button variant="ghost" size="icon-xs" aria-label="Deletar carrossel" onClick={handleDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        <div className="mt-auto flex items-center gap-2">
          <Badge variant="outline">
            <MessageSquareText />
            Tweet
          </Badge>
        </div>
      </div>
    </div>
  );
}
