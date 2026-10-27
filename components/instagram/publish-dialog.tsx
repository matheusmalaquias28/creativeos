"use client";

import { useMemo, useRef, useState } from "react";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { FrameRenderer, FrameThumbnail } from "@/components/carousel-studio/frame-renderer";
import { feedFormatError } from "@/lib/instagram/format";
import type { StudioDocument } from "@/types/carousel-studio";
import type { InstagramPost } from "@/types/instagram";
import { renderNodeToJpeg } from "./render";
import { useInstagramPosts } from "./post-history";
import { InstagramPublishShell, type PublishCard, type PublishSubmit } from "./publish-form";

const BUCKET = "instagram-posts";

/**
 * "Publicar no Instagram" do editor do Studio. Os cards são renderizados aqui
 * mesmo, com o FrameRenderer do Studio, e sobem em JPEG para o bucket
 * `instagram-posts` antes de criar o post.
 */
export function InstagramPublishDialog({
  open,
  onOpenChange,
  carouselId,
  doc,
  initialCaption,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carouselId: string;
  /** Documento com as alturas de texto medidas (o mesmo da exportação PNG). */
  doc: StudioDocument;
  initialCaption: string;
}) {
  const [rendering, setRendering] = useState<string[] | null>(null);
  const renderRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { posts, reload } = useInstagramPosts({ carouselId });
  const pageById = useMemo(() => new Map(doc.pages.map((p) => [p.id, p])), [doc.pages]);

  const cards: PublishCard[] = useMemo(
    () =>
      doc.pages.map((page, i) => ({
        id: page.id,
        label: `Página ${i + 1}`,
        thumb: (width: number) => <FrameThumbnail page={page} width={doc.width} height={doc.height} displayWidth={width} />,
      })),
    [doc]
  );

  const submit = async ({ ids, caption, scheduledAt, account, setProgress }: PublishSubmit): Promise<InstagramPost> => {
    // 1. Renderiza os cards fora da tela, em tamanho real.
    setProgress("Preparando os cards…");
    setRendering(ids);
    const blobs: Blob[] = [];
    try {
      await new Promise((r) => setTimeout(r, 150));
      for (const [i, pageId] of ids.entries()) {
        setProgress(`Gerando card ${i + 1} de ${ids.length}…`);
        const node = renderRefs.current.get(pageId);
        if (!node) throw new Error("Página não renderizada");
        blobs.push(await renderNodeToJpeg(node, doc.width, doc.height));
      }
    } finally {
      setRendering(null);
    }

    // 2. Sobe direto no Storage com URL assinada.
    setProgress("Enviando as imagens…");
    const targetRes = await fetch("/api/instagram/posts/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carouselId, count: blobs.length }),
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
        carouselId,
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
    <>
      <InstagramPublishShell
        open={open}
        onOpenChange={onOpenChange}
        cards={cards}
        minCards={2}
        initialCaption={initialCaption}
        blockingError={feedFormatError(doc.format)}
        emptyText="O carrossel ainda não tem páginas."
        posts={posts}
        reloadPosts={reload}
        onSubmit={submit}
      />

      {/* Cards fora da tela, em tamanho real, só enquanto gera os JPEGs. */}
      {rendering ? (
        <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
          {rendering.map((pageId) => {
            const page = pageById.get(pageId);
            if (!page) return null;
            return (
              <div
                key={pageId}
                ref={(el) => {
                  if (el) renderRefs.current.set(pageId, el);
                  else renderRefs.current.delete(pageId);
                }}
                style={{ width: doc.width, height: doc.height }}
              >
                <FrameRenderer page={page} width={doc.width} height={doc.height} exporting />
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
