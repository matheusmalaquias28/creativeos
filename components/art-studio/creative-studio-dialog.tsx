"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  Download,
  ImageIcon,
  Loader2,
  RotateCcw,
  Smartphone,
  Sparkles,
  StopCircle,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { ImageLightbox, type LightboxItem } from "@/components/ui/image-lightbox";
import { GenerationProgress } from "@/components/art-director/generation-progress";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import {
  isStoryWorking,
  isWorking,
  type ArtFormat,
  type StudioArtUrls,
  type StudioJob,
  type StudioState,
} from "@/lib/art-studio/types";
import { StudioArtCard } from "./studio-art-card";

type Props = {
  demandId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sem cliente vinculado não há kit de marca — nada a gerar. */
  hasClient: boolean;
};

type Tab = "artes" | "aprovadas" | "stories";

const EMPTY_URLS: StudioArtUrls = { feed: {}, story: {} };

/**
 * O estúdio: um modal, uma corrida.
 *
 * Tudo que antes estava espalhado entre a página de prompts e a de curadoria
 * acontece aqui, ao vivo: dirigir, gerar, apagar, regerar com o prompt alterado,
 * aprovar e adaptar as aprovadas para 9:16. Sem recarregar a página — o estado
 * inteiro chega pelo Realtime do Supabase, que é o que já movia as duas telas
 * antigas; o que faltava era juntá-las.
 */
export function CreativeStudioDialog({ demandId, open, onOpenChange, hasClient }: Props) {
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [urls, setUrls] = useState<StudioArtUrls>(EMPTY_URLS);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<"run" | "reset" | null>(null);
  const [queueingStories, setQueueingStories] = useState(false);
  const [tab, setTab] = useState<Tab>("artes");
  const [lightbox, setLightbox] = useState<{ format: ArtFormat; index: number } | null>(null);

  const jobIds = useRef<Set<string>>(new Set());
  jobIds.current = new Set(jobs.map((j) => j.id));

  // ------------------------------------------------------------------
  // Estado inicial: sempre relido ao abrir (ver /api/art-gen/studio)
  // ------------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/art-gen/studio?demandId=${demandId}`);
      const data = (await res.json()) as StudioState & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao carregar as artes");
        return;
      }
      setJobs(data.jobs ?? []);
      setUrls(data.urls ?? EMPTY_URLS);
    } catch {
      toast.error("Erro ao carregar as artes");
    } finally {
      setLoading(false);
    }
  }, [demandId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  // ------------------------------------------------------------------
  // Realtime
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`art-studio-${demandId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "art_generation_job",
          filter: `demand_id=eq.${demandId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removed = payload.old as { id?: string };
            if (!removed?.id) return;
            setJobs((prev) => prev.filter((j) => j.id !== removed.id));
            return;
          }

          const incoming = payload.new as StudioJob;
          setJobs((prev) => {
            const exists = prev.some((j) => j.id === incoming.id);
            const next = exists
              ? prev.map((j) => (j.id === incoming.id ? { ...j, ...incoming } : j))
              : [...prev, incoming];
            return next.sort((a, b) => a.art_index - b.art_index);
          });
        }
      )
      // art_version não tem coluna demand_id — filtra pelos jobs conhecidos.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "art_version" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const version = payload.new as {
            job_id: string;
            result_url: string;
            is_current: boolean;
            format?: string | null;
          };
          if (!version.is_current) return;
          if (!jobIds.current.has(version.job_id)) return;

          const format = (version.format ?? "feed") as ArtFormat;
          if (format !== "feed" && format !== "story") return;

          setUrls((prev) => ({
            ...prev,
            [format]: { ...prev[format], [version.job_id]: version.result_url },
          }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, demandId]);

  // ------------------------------------------------------------------
  // Ações
  // ------------------------------------------------------------------

  async function start(reset: boolean) {
    setStarting(reset ? "reset" : "run");
    try {
      const res = await fetch("/api/art-gen/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId, reset }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao gerar os criativos");
        return;
      }
      if (reset) {
        setJobs([]);
        setUrls(EMPTY_URLS);
      }
      setTab("artes");
      toast.success("Gerando — as artes aparecem aqui conforme ficam prontas");
    } catch {
      toast.error("Erro ao gerar os criativos");
    } finally {
      setStarting(null);
    }
  }

  const approve = useCallback(async (jobId: string, approved: boolean) => {
    const res = await fetch(`/api/art-gen/${jobId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    if (!res.ok) {
      toast.error("Erro ao aprovar");
      return;
    }
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, approved } : j)));
  }, []);

  const remove = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/art-gen/${jobId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(data.error ?? "Erro ao apagar a arte");
      return;
    }
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    toast.success("Arte apagada");
  }, []);

  const regenerate = useCallback(async (jobId: string, prompt: string) => {
    const res = await fetch(`/api/art-gen/${jobId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao regerar");
      return;
    }
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "queued", error: null } : j))
    );
    toast.success("Regerando com o prompt ajustado");
  }, []);

  async function generateStories() {
    setQueueingStories(true);
    try {
      const res = await fetch("/api/art-gen/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId }),
      });
      const data = (await res.json()) as { queued?: number; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao gerar os stories");
        return;
      }
      setTab("stories");
      toast.success(`${data.queued ?? 0} arte(s) sendo adaptada(s) para 9:16`);
    } catch {
      toast.error("Erro ao gerar os stories");
    } finally {
      setQueueingStories(false);
    }
  }

  async function cancel() {
    const res = await fetch("/api/art-gen/cancel-demand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demandId }),
    });
    if (!res.ok) {
      toast.error("Erro ao cancelar");
      return;
    }
    const data = (await res.json()) as { cancelled?: number };
    toast.info(`${data.cancelled ?? 0} arte(s) cancelada(s)`);
    void load();
  }

  // ------------------------------------------------------------------
  // Derivados
  // ------------------------------------------------------------------

  const approvedJobs = useMemo(() => jobs.filter((j) => j.approved), [jobs]);
  const storyJobs = useMemo(
    () => jobs.filter((j) => urls.story[j.id] || j.story_status !== "idle"),
    [jobs, urls.story]
  );

  const busy = jobs.some(isWorking);
  const storiesBusy = jobs.some(isStoryWorking);

  const artProgress = useMemo(
    () => ({
      total: jobs.length,
      done: jobs.filter((j) => j.status === "succeeded").length,
      working: jobs.filter(isWorking).length,
      failed: jobs.filter((j) => j.status === "failed").length,
    }),
    [jobs]
  );

  const storyProgress = useMemo(
    () => ({
      total: storyJobs.length,
      done: storyJobs.filter((j) => j.story_status === "succeeded").length,
      working: storyJobs.filter(isStoryWorking).length,
      failed: storyJobs.filter((j) => j.story_status === "failed").length,
    }),
    [storyJobs]
  );

  const readyApproved = approvedJobs.filter((j) => urls.feed[j.id]).length;

  const lightboxSets: Record<ArtFormat, LightboxItem[]> = useMemo(
    () => ({
      feed: jobs
        .filter((j) => urls.feed[j.id])
        .map((j) => ({
          url: urls.feed[j.id],
          label: `Arte ${j.art_index + 1}`,
          downloadName: `arte-${j.art_index + 1}.png`,
        })),
      story: storyJobs
        .filter((j) => urls.story[j.id])
        .map((j) => ({
          url: urls.story[j.id],
          label: `Story ${j.art_index + 1}`,
          downloadName: `arte-${j.art_index + 1}-story.png`,
        })),
    }),
    [jobs, storyJobs, urls]
  );

  const openFullscreen = useCallback(
    (format: ArtFormat) => (url: string) => {
      const index = lightboxSets[format].findIndex((item) => item.url === url);
      if (index >= 0) setLightbox({ format, index });
    },
    [lightboxSets]
  );

  function downloadAll(format: ArtFormat) {
    const items = lightboxSets[format];
    if (items.length === 0) {
      toast.info("Nada para baixar ainda");
      return;
    }
    for (const item of items) {
      const a = document.createElement("a");
      a.href = item.url;
      a.download = item.downloadName ?? "arte.png";
      a.target = "_blank";
      a.click();
    }
    toast.success(`${items.length} arquivo(s)`);
  }

  const cardProps = {
    onApprove: approve,
    onDelete: remove,
    onRegenerate: regenerate,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[6vh] max-h-[88vh] max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-tone-pink" />
            Gerar Criativos
          </DialogTitle>
          <DialogDescription>
            Direção de arte, geração, curadoria e adaptação para stories — tudo aqui,
            em tempo real.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {!hasClient && (
            <p
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] font-medium",
                tones.amber.badge
              )}
            >
              <AlertTriangle className="size-3.5 shrink-0" />
              Vincule um cliente à demanda antes de gerar criativos.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void start(false)}
              disabled={!hasClient || starting !== null || busy}
              className="gap-2"
            >
              {starting === "run" || busy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Wand2 />
              )}
              {jobs.length > 0 ? "Gerar as que faltam" : "Gerar Criativos"}
            </Button>

            {jobs.length > 0 && (
              <Button
                variant="outline"
                onClick={() => void start(true)}
                disabled={!hasClient || starting !== null || busy}
                className="gap-2"
                title="Apaga as artes atuais e gera todas de novo"
              >
                {starting === "reset" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                Recomeçar
              </Button>
            )}

            {busy && (
              <Button variant="destructive" onClick={() => void cancel()} className="gap-2">
                <StopCircle />
                Cancelar
              </Button>
            )}

            <span className="ml-auto flex items-center gap-1.5">
              <Badge variant="secondary" className="tabular-nums">
                {jobs.length} arte(s)
              </Badge>
              <Badge variant="green" className="tabular-nums">
                {approvedJobs.length} aprovada(s)
              </Badge>
            </span>
          </div>

          <GenerationProgress counts={artProgress} label="Gerando as artes" />
          <GenerationProgress counts={storyProgress} label="Adaptando para stories" />

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Wand2}
              tone="pink"
              title="Nenhum criativo ainda"
              description="Clique em Gerar Criativos — as artes aparecem aqui uma a uma, sem recarregar."
            />
          ) : (
            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
              <TabsList>
                <TabsTrigger value="artes">
                  <ImageIcon className="size-3.5" />
                  Artes
                  <Badge variant="secondary" className="tabular-nums">
                    {jobs.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="aprovadas">
                  <CheckCheck className="size-3.5" />
                  Aprovadas
                  <Badge variant="green" className="tabular-nums">
                    {approvedJobs.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="stories">
                  <Smartphone className="size-3.5" />
                  Stories
                  <Badge variant="cyan" className="tabular-nums">
                    {storyJobs.length}
                  </Badge>
                </TabsTrigger>
                <TabsIndicator />
              </TabsList>

              <TabsPanel value="artes" className="pt-5">
                <Grid>
                  {jobs.map((job) => (
                    <StudioArtCard
                      key={job.id}
                      job={job}
                      format="feed"
                      url={urls.feed[job.id] ?? null}
                      onOpenFullscreen={openFullscreen("feed")}
                      {...cardProps}
                    />
                  ))}
                </Grid>
              </TabsPanel>

              <TabsPanel value="aprovadas" className="pt-5">
                {approvedJobs.length === 0 ? (
                  <EmptyState
                    icon={CheckCheck}
                    tone="green"
                    compact
                    title="Nenhuma arte aprovada"
                    description="Aprove as artes na aba Artes — só as aprovadas viram stories."
                  />
                ) : (
                  <Grid>
                    {approvedJobs.map((job) => (
                      <StudioArtCard
                        key={job.id}
                        job={job}
                        format="feed"
                        url={urls.feed[job.id] ?? null}
                        onOpenFullscreen={openFullscreen("feed")}
                        {...cardProps}
                      />
                    ))}
                  </Grid>
                )}
              </TabsPanel>

              <TabsPanel value="stories" className="pt-5">
                {storyJobs.length === 0 ? (
                  <EmptyState
                    icon={Smartphone}
                    tone="cyan"
                    compact
                    title="Nenhum story ainda"
                    description="Aprove as artes e use “Gerar stories das aprovadas” — a peça é reenquadrada em 9:16, sem texto novo."
                  />
                ) : (
                  <Grid>
                    {storyJobs.map((job) => (
                      <StudioArtCard
                        key={job.id}
                        job={job}
                        format="story"
                        url={urls.story[job.id] ?? null}
                        onOpenFullscreen={openFullscreen("story")}
                        {...cardProps}
                      />
                    ))}
                  </Grid>
                )}
              </TabsPanel>
            </Tabs>
          )}
        </DialogBody>

        <DialogFooter className="justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadAll(tab === "stories" ? "story" : "feed")}
            className="gap-2"
          >
            <Download className="size-3.5" />
            Baixar {tab === "stories" ? "stories" : "artes"}
          </Button>

          <Button
            variant="highlight"
            onClick={() => void generateStories()}
            disabled={readyApproved === 0 || queueingStories || storiesBusy}
            className="gap-2"
          >
            {queueingStories || storiesBusy ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Smartphone />
            )}
            Gerar stories das aprovadas ({readyApproved})
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      {/* Fora do Dialog e acima dele: o popup é portalizado em z-50, e o
          visualizador precisa cobri-lo para a arte ser conferida em tela cheia. */}
      <div className="relative z-[60]">
        <ImageLightbox
          items={lightbox ? lightboxSets[lightbox.format] : []}
          index={lightbox?.index ?? null}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
        />
      </div>
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">{children}</div>
  );
}
