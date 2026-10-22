import { Archive, LayoutGrid, Video } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { VideoDemandsBoard } from "@/components/video-demands/video-demands-board";
import { VideoDemandsRealtimeListener } from "@/components/video-demands/video-demands-realtime-listener";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { layout } from "@/lib/design/tokens";
import { getVideoDemandsForUser } from "@/services/video-demands";

export const maxDuration = 120;

type SearchParams = { archived?: string };

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { archived: archivedParam } = await searchParams;
  const showArchived = archivedParam === "1";

  const demands = await getVideoDemandsForUser(showArchived);

  return (
    <DashboardPage
      title="Vídeos"
      description="Demandas de vídeo recebidas via webhook do WAR — da chegada à entrega."
      headerContent={
        <SegmentedControl
          aria-label="Filtrar demandas de vídeo"
          value={showArchived ? "archived" : "active"}
          options={[
            {
              value: "active",
              label: "Ativas",
              href: "/videos",
              icon: <LayoutGrid className="size-3.5" />,
              count: showArchived ? undefined : demands.length,
            },
            {
              value: "archived",
              label: "Arquivadas",
              href: "/videos?archived=1",
              icon: <Archive className="size-3.5" />,
              count: showArchived ? demands.length : undefined,
            },
          ]}
        />
      }
    >
      <VideoDemandsRealtimeListener />

      <div className={layout.sectionGap}>
        {!showArchived &&
          (demands.length === 0 ? (
            <EmptyState
              icon={Video}
              tone="pink"
              title="Nenhuma demanda de vídeo ainda"
              description={
                <>
                  O WAR envia POST em{" "}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    /api/webhooks/make/demands
                  </code>{" "}
                  com <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">tipo: &quot;video&quot;</code> — demandas de vídeo caem aqui automaticamente.
                </>
              }
            />
          ) : (
            <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
              <VideoDemandsBoard initialDemands={demands} />
            </div>
          ))}

        {showArchived &&
          (demands.length === 0 ? (
            <EmptyState
              icon={Archive}
              tone="slate"
              title="Nenhuma demanda de vídeo arquivada"
              description="Vídeos concluídos ou arquivados manualmente aparecem aqui."
            />
          ) : (
            <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
              <VideoDemandsBoard initialDemands={demands} />
            </div>
          ))}
      </div>
    </DashboardPage>
  );
}
