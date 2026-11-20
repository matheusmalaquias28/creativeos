"use client";

import { useMemo } from "react";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { TweetCardPreview } from "@/components/carousel/tweet/tweet-card-canvas";
import type { InstagramPost } from "@/types/instagram";
import type { TweetCard, TweetProfileSnapshot, TweetTheme } from "@/types/tweet-carousel";
import { imageToInstagramJpeg } from "./render";
import { useInstagramPosts } from "./post-history";
import { InstagramPublishShell, type PublishCard, type PublishSubmit } from "./publish-form";

const BUCKET = "instagram-posts";

/**
 * "Publicar no Instagram" do carrossel estilo tweet. Mesmo fluxo do Studio:
 * os cards são renderizados no navegador (o mesmo PNG 1080×1350 do "Baixar"),
 * viram JPEG e sobem para o bucket `instagram-posts` antes de criar o post.
 */
export function TweetInstagramPublishDialog({
  open,
  onOpenChange,
  tweetCarouselId,
  cards,
  profile,
  theme,
  renderCard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tweetCarouselId: string;
  cards: TweetCard[];
  profile: TweetProfileSnapshot;
  theme: TweetTheme;
  /** Renderiza o card em tamanho real (PNG), o mesmo da exportação. */
  renderCard: (cardId: string) => Promise<Blob>;
}) {
  const { posts, reload } = useInstagramPosts({ tweetCarouselId });

  const publishCards: PublishCard[] = useMemo(
    () =>
      cards.map((card, i) => ({
        id: card.id,
        label: `Card ${i + 1}`,
        thumb: (width: number) => (
          <div style={{ width }}>
            <TweetCardPreview card={card} profile={profile} theme={theme} />
          </div>
        ),
      })),
    [cards, profile, theme]
  );

  const submit = async ({ ids, caption, scheduledAt, account, setProgress }: PublishSubmit): Promise<InstagramPost> => {
    // 1. Renderiza os cards em tamanho real e converte para JPEG.
    setProgress("Preparando os cards…");
    const blobs: Blob[] = [];
    for (const [i, cardId] of ids.entries()) {
      setProgress(`Gerando card ${i + 1} de ${ids.length}…`);
      blobs.push(await imageToInstagramJpeg(await renderCard(cardId)));
    }

    // 2. Sobe direto no Storage com URL assinada.
    setProgress("Enviando as imagens…");
    const targetRes = await fetch("/api/instagram/posts/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweetCarouselId, count: blobs.length }),
    });
    const upload = await targetRes.json().catch(() => ({}));
    if (!targetRes.ok) throw new Error(upload.error ?? "Não foi possível preparar o envio");
    const targets = upload.targets as { path: string; token: string }[];
    const supabase = createBrowserSupabase();
    for (const [i, blob] of blobs.entries()) {
      setProgress(`Enviando card ${i + 1} de ${blobs.length}…`);
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(targets[i].path, targets[i].token, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(`Falha no upload do card ${i + 1}: ${error.message}`);
    }

    // 3. Cria o post (e publica, se for agora).
    setProgress(scheduledAt ? "Agendando…" : "Publicando no Instagram… pode levar até 1 minuto.");
    const res = await fetch("/api/instagram/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: upload.postId,
        tweetCarouselId,
        items: targets.map((t, i) => ({ path: t.path, page_id: ids[i] })),
        caption,
        scheduledAt,
        igUserId: account.igUserId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o post");
    return data.post as InstagramPost;
  };

  return (
    <InstagramPublishShell
      open={open}
      onOpenChange={onOpenChange}
      cards={publishCards}
      minCards={2}
      initialCaption=""
      emptyText="O carrossel ainda não tem cards."
      posts={posts}
      reloadPosts={reload}
      onSubmit={submit}
    />
  );
}
