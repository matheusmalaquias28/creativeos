"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, ExternalLink, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInstagramDate } from "@/lib/instagram/schedule";
import { INSTAGRAM_POST_STATUS_LABEL, type InstagramPost, type InstagramPostStatus } from "@/types/instagram";

const STATUS_VARIANT: Record<InstagramPostStatus, "secondary" | "blue" | "amber" | "green" | "red" | "slate"> = {
  draft: "secondary",
  scheduled: "blue",
  publishing: "amber",
  published: "green",
  failed: "red",
  canceled: "slate",
};

/** Posts do carrossel (agendados e publicados), ao vivo via Realtime. */
export function useInstagramPosts(carouselId: string) {
  const [posts, setPosts] = useState<InstagramPost[] | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/instagram/posts?carouselId=${carouselId}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPosts(data.posts ?? []);
    else setPosts([]);
  }, [carouselId]);

  useEffect(() => {
    reload();
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`instagram-posts-${carouselId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instagram_posts", filter: `studio_carousel_id=eq.${carouselId}` },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [carouselId, reload]);

  return { posts, reload };
}

function whenLabel(post: InstagramPost): string {
  if (post.status === "published" && post.published_at) return `Publicado em ${formatInstagramDate(post.published_at)}`;
  if (post.scheduled_at) return `Agendado para ${formatInstagramDate(post.scheduled_at)}`;
  return `Criado em ${formatInstagramDate(post.created_at)}`;
}

export function InstagramPostList({
  posts,
  onChanged,
  emptyText = "Nenhum post ainda.",
}: {
  posts: InstagramPost[] | null;
  onChanged?: () => void;
  emptyText?: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (post: InstagramPost, action: "cancel" | "publish") => {
    if (action === "publish" && !window.confirm(`Publicar agora ${post.items.length} cards em @${post.ig_username ?? post.ig_user_id}?`)) return;
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/instagram/posts/${post.id}/${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha na ação");
      const updated = data.post as InstagramPost;
      if (action === "cancel") toast.success("Agendamento cancelado");
      else if (updated.status === "published") toast.success("Publicado no Instagram");
      else toast.error(updated.error ?? "A publicação falhou");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na ação");
    } finally {
      setBusyId(null);
    }
  };

  if (posts === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Carregando posts…
      </p>
    );
  }
  if (posts.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {posts.map((post) => (
        <li key={post.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
          {post.items[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.items[0].url} alt="" className="h-12 w-10 shrink-0 rounded-md object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[post.status]}>{INSTAGRAM_POST_STATUS_LABEL[post.status]}</Badge>
              <span className="text-muted-foreground">
                {post.items.length} cards · @{post.ig_username ?? post.ig_user_id}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{whenLabel(post)}</p>
            {post.status === "failed" && post.error ? <p className="mt-1 text-xs text-tone-red">{post.error}</p> : null}
          </div>
          <div className="flex items-center gap-1.5">
            {post.permalink ? (
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-primary hover:bg-accent"
              >
                Ver post <ExternalLink className="size-3" />
              </a>
            ) : null}
            {post.status === "scheduled" ? (
              <Button size="xs" variant="outline" disabled={busyId === post.id} onClick={() => act(post, "cancel")}>
                {busyId === post.id ? <Loader2 className="animate-spin" /> : <Ban />}
                Cancelar agendamento
              </Button>
            ) : null}
            {post.status === "failed" ? (
              <Button size="xs" variant="outline" disabled={busyId === post.id} onClick={() => act(post, "publish")}>
                {busyId === post.id ? <Loader2 className="animate-spin" /> : <RotateCw />}
                Tentar de novo
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Histórico na página da demanda. Some enquanto não houver post. */
export function InstagramPostHistory({ carouselId }: { carouselId: string }) {
  const { posts, reload } = useInstagramPosts(carouselId);
  if (!posts || posts.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-heading text-foreground">Instagram</h2>
        <p className="text-sm text-muted-foreground">Posts agendados e publicados deste carrossel.</p>
      </div>
      <InstagramPostList posts={posts} onChanged={reload} />
    </section>
  );
}
