"use client";

import { useMemo, useState } from "react";
import { CloudCheck, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DemandExportFile } from "@/types/demand-export";
import type { InstagramPost } from "@/types/instagram";
import { useInstagramPosts } from "./post-history";
import { InstagramPublishShell, type PublishCard, type PublishSubmit } from "./publish-form";

function ArtThumb({ file, width }: { file: DemandExportFile; width: number }) {
  const height = Math.round(width * 1.25);
  // Depois da entrega ao Drive a cópia do Storage é apagada: mostra um marcador
  // (o servidor busca a arte no Drive na hora de publicar).
  if (file.drive_file_id) {
    return (
      <div
        style={{ width, height }}
        className="flex flex-col items-center justify-center gap-1 bg-muted px-1 text-center text-[10px] text-muted-foreground"
      >
        <CloudCheck className="size-4" />
        No Drive
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={file.public_url} alt="" style={{ width, height }} className="bg-muted object-cover" />;
}

/**
 * Botão "Publicar no Instagram" da página da demanda, ao lado de "Entregar
 * demanda". Usa as artes do feed já enviadas na entrega (1 = post simples,
 * 2 ou mais = carrossel).
 */
export function DemandInstagramButton({
  demandId,
  files,
  initialCaption,
}: {
  demandId: string;
  files: DemandExportFile[];
  initialCaption: string;
}) {
  const [open, setOpen] = useState(false);
  const { posts, reload } = useInstagramPosts({ demandId });

  const feed = useMemo(
    () => files.filter((f) => f.format === "feed").sort((a, b) => a.art_index - b.art_index),
    [files]
  );
  const cards: PublishCard[] = useMemo(
    () =>
      feed.map((file) => ({
        id: file.id,
        label: `Arte ${file.art_index}`,
        thumb: (width: number) => <ArtThumb file={file} width={width} />,
      })),
    [feed]
  );

  const submit = async ({ ids, caption, scheduledAt, account, setProgress }: PublishSubmit): Promise<InstagramPost> => {
    setProgress(scheduledAt ? "Preparando as imagens e agendando…" : "Preparando as imagens e publicando no Instagram… pode levar até 1 minuto.");
    const res = await fetch("/api/instagram/demand-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demandId, fileIds: ids, caption, scheduledAt, igUserId: account.igUserId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o post");
    return data.post as InstagramPost;
  };

  const scheduled = posts?.filter((p) => p.status === "scheduled").length ?? 0;
  const published = posts?.filter((p) => p.status === "published").length ?? 0;

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Megaphone className="size-4" />
        Publicar no Instagram
        {published || scheduled ? (
          <span className="rounded-full bg-secondary px-1.5 text-[0.6875rem] font-semibold">
            {published ? `${published} publicado${published > 1 ? "s" : ""}` : `${scheduled} agendado${scheduled > 1 ? "s" : ""}`}
          </span>
        ) : null}
      </Button>
      <InstagramPublishShell
        open={open}
        onOpenChange={setOpen}
        cards={cards}
        minCards={1}
        initialCaption={initialCaption}
        emptyText='Nenhuma arte do feed na entrega ainda. Suba o feed em "Entregar demanda" e volte aqui.'
        posts={posts}
        reloadPosts={reload}
        onSubmit={submit}
      />
    </>
  );
}
