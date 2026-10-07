"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, useEdges } from "@xyflow/react";
import {
  Sparkles,
  Pause,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Plus,
  Minus,
  RefreshCw,
  Gauge,
  Library,
  FolderUp,
  ScanEye,
} from "lucide-react";
import type { Node } from "@xyflow/react";
import { toast } from "sonner";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import { flowHandleClass } from "@/components/flow/nodes/node-shell";
import { ImageLightbox } from "@/components/flow/nodes/node-image";
import { NodeSelect } from "@/components/flow/nodes/node-select";
import { LibraryPickerDialog } from "@/components/image-library/library-picker-dialog";
import { SendToDriveDialog } from "@/components/flow/send-to-drive-dialog";
import { GenerationPreviewDialog } from "@/components/flow/nodes/generation-preview-dialog";
import { CATEGORY_META, type ReferenceCategory } from "@/lib/image-library/categories";
import {
  LOGO_POSITIONS,
  LOGO_SIZES,
  DEFAULT_LOGO_POSITION,
  DEFAULT_LOGO_SIZE,
  buildLogoDirective,
  type LogoSize,
} from "@/lib/flow/logo-directive";
import { upsertMentionLine } from "@/lib/flow/mention-text";
import { STORY_QUALITY } from "@/lib/flow/story-defaults";
import { downloadImageUrl } from "@/lib/flow/download-image";
import { slugify } from "@/lib/utils/slug";
import {
  getPromptArteEditorText,
  parsePromptArteText,
} from "@/lib/flow/prompt-arte-text";
import { cn } from "@/lib/utils";
import type { ArteData, ClienteLogoData, ReferenciaImagemData } from "@/lib/flow/types";
import type { LibraryImage } from "@/services/image-library";

type Props = { id: string; data: ArteData; selected?: boolean };

const ASPECT_OPTIONS = ["4:5", "9:16", "1:1", "3:4", "16:9"];
const QUALITY_OPTIONS = ["low", "medium", "high"] as const;
const SIZE_OPTIONS = ["1K", "2K", "4K"];
const MAX_COUNT = 6;

/** "4:5" → "4 / 5" para o CSS aspect-ratio. */
function aspectCss(aspect: string | undefined): string {
  const [w, h] = (aspect ?? "4:5").split(":");
  return `${w || 4} / ${h || 5}`;
}

/** Ícone de retângulo que reflete a proporção escolhida (como no Magnific). */
function AspectGlyph({ aspect }: { aspect: string }) {
  const [w, h] = aspect.split(":").map(Number);
  const r = (w || 4) / (h || 5);
  const width = r >= 1 ? 13 : Math.max(6, Math.round(13 * r));
  const height = r >= 1 ? Math.max(6, Math.round(13 / r)) : 13;
  return <span className="shrink-0 rounded-[3px] border-[1.5px] border-current" style={{ width, height }} />;
}

/**
 * Texto do prompt com as menções `@(nome)` renderizadas como chip — SÓ quando
 * a menção casa com uma referência realmente conectada ao node (badge verde
 * com o nome). `@(algo)` sem vínculo é texto solto igual ao resto — não vira
 * badge nenhum, pra não parecer uma referência que não existe de verdade.
 */
function PromptPreview({ text, linked }: { text: string; linked: Set<string> }) {
  return (
    <>
      {text.split(/(@\([^)]+\))/g).map((part, i) => {
        const m = /^@\(([^)]+)\)$/.exec(part);
        const isLinked = m && linked.has(part.toLowerCase());
        if (!isLinked) return <span key={i}>{part}</span>;
        return (
          <span
            key={i}
            className="mx-0.5 rounded-md bg-emerald-500/85 px-1.5 py-px text-[0.75rem] font-semibold text-white"
          >
            @{m[1]}
          </span>
        );
      })}
    </>
  );
}

const glassIconBtn =
  "nodrag flex size-6 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-35";

// Botões da barra de ações FORA do card (tema claro/escuro, não glass).
const topIconBtn =
  "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35";

function detectMention(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const frag = before.slice(at + 1);
  if (/[\s\n]/.test(frag) || frag.startsWith("(")) return null;
  return { start: at, query: frag };
}

export function ArteNode({ id, data, selected }: Props) {
  const { setNodes, setEdges, getNode } = useReactFlow();
  const { scheduleAutoSave, saveNow } = useFlowCanvas();
  const edges = useEdges();
  const isStory = data.format === "story";
  const [pickerOpen, setPickerOpen] = useState(false);

  // ─── Prompt (expande sobre a imagem ao editar) ──────────────────────────
  const [promptOpen, setPromptOpen] = useState(false);
  const [draft, setDraft] = useState(() => getPromptArteEditorText(data));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  useEffect(() => {
    if (taRef.current === document.activeElement) return;
    setDraft(getPromptArteEditorText(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.promptText, data.headline, data.subheadline, data.cta, data.informacoesExtras]);

  const commit = useCallback(
    (text: string, persist?: boolean) => {
      const parsed = parsePromptArteText(text, data.artIndex, data);
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...parsed } } : n)));
      if (persist) void saveNow();
      else scheduleAutoSave();
    },
    [data, id, saveNow, scheduleAutoSave, setNodes]
  );

  const scheduleCommit = useCallback((text: string) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commit(text), 400);
  }, [commit]);

  useEffect(() => () => { if (commitTimer.current) clearTimeout(commitTimer.current); }, []);

  // Referências mencionáveis (@): nodes conectados à entrada deste node.
  const mentionable = edges
    .filter((e) => e.target === id)
    .map((e) => getNode(e.source))
    .filter((n): n is NonNullable<typeof n> => n != null)
    .flatMap((n) => {
      if (n.type === "referenciaImagem") {
        const label = (n.data as ReferenciaImagemData).label || "imagem";
        const url = (n.data as ReferenciaImagemData).imageUrl;
        return [{ label, url, token: `@(${label.toLowerCase().replace(/\s+/g, "-")})` }];
      }
      const logoUrl = n.type === "clienteLogo" ? (n.data as ClienteLogoData).logoUrl : null;
      if (logoUrl) {
        return [{ label: "logo", url: logoUrl, token: "@(logo)" }];
      }
      return [];
    });
  // Tokens de referências realmente conectadas — menção com vínculo fica verde.
  const linkedTokens = new Set(mentionable.map((m) => m.token.toLowerCase()));
  const mentionOpts = mention
    ? mentionable.filter((m) => m.label.toLowerCase().includes(mention.query.toLowerCase()))
    : [];
  const showMention = mention !== null && mentionOpts.length > 0;

  function openEditor(next: string, mentionAtEnd = false) {
    setDraft(next);
    setPromptOpen(true);
    setMention(mentionAtEnd ? { start: next.length - 1, query: "" } : null);
    setMentionIdx(0);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.length, next.length);
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  /** "+" na fileira de referências: abre o editor já com o menu de @. */
  function startMention() {
    const base = draftRef.current;
    openEditor(`${base}${base && !/\s$/.test(base) ? " " : ""}@`, true);
  }

  /** Clique numa thumb: insere a menção dela no fim do prompt. */
  function insertToken(token: string) {
    const base = draftRef.current;
    const next = `${base}${base && !/\s$/.test(base) ? " " : ""}${token} `;
    openEditor(next);
    scheduleCommit(next);
  }

  function pickMention(token: string, query: string, start: number) {
    const next = draft.slice(0, start) + token + draft.slice(start + 1 + query.length);
    setDraft(next);
    setMention(null);
    scheduleCommit(next);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) { el.focus(); const p = start + token.length; el.setSelectionRange(p, p); }
    });
  }

  // ─── Controles ────────────────────────────────────────────────────────
  function update(patch: Partial<ArteData>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    scheduleAutoSave();
  }

  // ─── Acervo: imagem escolhida vira um node de referência conectado ──────
  function addLibraryReference(image: LibraryImage, category: ReferenceCategory) {
    const self = getNode(id);
    const meta = CATEGORY_META[category];

    // Label único entre as refs conectadas — evita colisão de @(mesma-categoria).
    const taken = new Set(mentionable.map((m) => m.label.toLowerCase()));
    let label = meta.mentionName;
    for (let i = 2; taken.has(label.toLowerCase()); i++) label = `${meta.mentionName} ${i}`;
    const token = `@(${label.toLowerCase().replace(/\s+/g, "-")})`;

    const refId = `referenciaImagem-${Date.now()}`;
    const refNode: Node = {
      id: refId,
      type: "referenciaImagem",
      position: self
        ? { x: self.position.x - 260, y: self.position.y + 40 }
        : { x: 0, y: 0 },
      data: {
        imageUrl: image.storage_url,
        label,
        category,
        intent: `${label}: ${meta.instruction}`,
      } satisfies ReferenciaImagemData,
    };
    setNodes((ns) => [...ns, refNode]);
    setEdges((es) => [
      ...es,
      {
        id: `e-${refId}-${id}`,
        source: refId,
        target: id,
        targetHandle: "refs",
        type: "default",
        animated: false,
        style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
      },
    ]);

    // Reforça no prompt: menção @ + guia de uso da categoria escolhida.
    const base = draftRef.current;
    const guideLine = `${token} — ${meta.instruction}`;
    const nextPrompt = base.trim() ? `${base}\n${guideLine}` : guideLine;
    setDraft(nextPrompt);
    commit(nextPrompt);
  }

  // ─── Geração (in-node) ──────────────────────────────────────────────────
  const [triggering, setTriggering] = useState(false);
  const status = data.generatingStatus;
  const isGenerating = status === "queued" || status === "processing";

  async function handleGenerate() {
    if (!data.demandId) { toast.error("Salve o fluxo antes de gerar"); return; }
    setTriggering(true);
    try {
      // A geração lê o fluxo SALVO: salva já, senão o que acabou de ser
      // apagado/editado no canvas (ainda no debounce) iria na geração.
      if (!(await saveNow())) throw new Error("Não foi possível salvar o fluxo");
      const res = await fetch(`/api/demands/${data.demandId}/flow/run-node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artIndex: data.artIndex }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Erro");
      update({ generatingStatus: "queued" });
    } catch (err) {
      toast.error("Erro ao gerar", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setTriggering(false);
    }
  }

  async function handlePause() {
    if (!data.demandId) return;
    try {
      await fetch(`/api/art-gen/cancel-demand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId: data.demandId }),
      });
      update({ generatingStatus: "failed" });
    } catch {
      /* best-effort */
    }
  }

  // ─── Pilha de resultados ────────────────────────────────────────────────
  const stack = data.resultUrls?.length
    ? data.resultUrls
    : data.resultUrl
      ? [{ versionId: "current", url: data.resultUrl }]
      : [];
  const [idx, setIdx] = useState(stack.length - 1);
  useEffect(() => { setIdx(Math.max(0, stack.length - 1)); }, [stack.length]);
  const safeIdx = Math.min(Math.max(0, idx), Math.max(0, stack.length - 1));
  const current = stack[safeIdx];
  const [lightbox, setLightbox] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const count = data.count ?? 1;
  const aspect = data.aspectRatio ?? "4:5";

  // Logo conectada a este node? Só então faz sentido o controle de posição/tamanho.
  const hasLogo = mentionable.some((m) => m.label === "logo");
  const logoPosition = data.logoPosition ?? DEFAULT_LOGO_POSITION;
  const logoSize: LogoSize = data.logoSize ?? DEFAULT_LOGO_SIZE;
  const logoSizeLevel = LOGO_SIZES.findIndex((s) => s.value === logoSize); // 0..2

  // O seletor não guarda nenhuma instrução escondida: ele só cola a frase
  // `@(logo) — ...` no texto do prompt. O que vai pro modelo é exatamente
  // o que aparece aqui, editável pelo operador como qualquer outro texto.
  function applyLogoDirective(position: string, size: LogoSize) {
    const next = upsertMentionLine(draftRef.current, "logo", buildLogoDirective(position, size));
    setDraft(next);
    commit(next);
  }

  function cycleLogoSize() {
    const next = LOGO_SIZES[(logoSizeLevel + 1) % LOGO_SIZES.length].value;
    update({ logoSize: next });
    applyLogoDirective(logoPosition, next);
  }

  // Ao conectar a logo pela primeira vez, já cola a frase padrão no prompt —
  // nunca fica uma posição/tamanho "assumidos" sem aparecer no texto.
  useEffect(() => {
    if (!hasLogo || isStory) return;
    if (draftRef.current.toLowerCase().includes("@(logo)")) return;
    applyLogoDirective(logoPosition, logoSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLogo, isStory]);

  // Nome do arquivo: SEMPRE o nome da demanda + um número (o índice da arte)
  // pra diferenciar — nunca o label do node (que pode ter sido renomeado).
  const downloadFilename = (() => {
    const demandName = data.briefingTitulo?.trim() || data.label?.trim() || "arte";
    return `${slugify(demandName) || "arte"}-${data.artIndex + 1}.png`;
  })();

  function download() {
    if (!current) return;
    void downloadImageUrl(current.url, downloadFilename);
  }

  const statusPill =
    status === "queued" ? { label: "Na fila", dot: "bg-amber-400" }
    : status === "processing" ? { label: "Gerando", dot: "bg-sky-400 animate-pulse" }
    : status === "failed" ? { label: "Falhou", dot: "bg-red-400" }
    : current ? { label: "Pronta", dot: "bg-emerald-400" }
    : null;

  return (
    <div className="w-80">
      {/* Título + ações fora do card (pilha, dimensões, status, download) */}
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-foreground/90">
          {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          <span className="truncate">{data.label ?? `Arte ${data.artIndex + 1}`}</span>
        </div>

        {stack.length > 0 && (
          <div className="flex h-7 items-center rounded-full border border-border bg-card px-1 text-xs font-bold tabular-nums text-foreground">
            <button type="button" disabled={stack.length < 2} title="Anterior"
              onClick={() => setIdx((i) => (i - 1 + stack.length) % stack.length)}
              className={topIconBtn}>
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="px-1">
              {String(safeIdx + 1).padStart(2, "0")}/{String(stack.length).padStart(2, "0")}
            </span>
            <button type="button" disabled={stack.length < 2} title="Próxima"
              onClick={() => setIdx((i) => (i + 1) % stack.length)}
              className={topIconBtn}>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}
        {data.demandId && (
          <button type="button" onClick={() => setPreviewOpen(true)} title="Ver tudo o que vai na geração (prompt, imagens, lote)"
            className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
            <ScanEye className="size-3.5" />
          </button>
        )}
        {current && (
          <button type="button" onClick={() => setDriveOpen(true)} title="Enviar para o Drive desta demanda"
            className="flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
            <FolderUp className="size-3.5" /> Drive
          </button>
        )}
        {statusPill && (
          <span className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-semibold text-foreground">
            <span className={cn("size-1.5 rounded-full", statusPill.dot)} />
            {statusPill.label}
          </span>
        )}
        {current && (
          <button type="button" onClick={download} title="Baixar"
            className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
            <Download className="size-3.5" />
          </button>
        )}
      </div>

      <div
        className={cn(
          "relative w-full rounded-[1.75rem] border-2 bg-neutral-900 text-white shadow-[var(--surface-shadow)] transition-colors",
          selected ? "border-primary" : "border-white/10 hover:border-white/25"
        )}
        style={{ aspectRatio: aspectCss(aspect), minHeight: 420 }}
      >
        {/* Entradas: logo / refs / lista */}
        {!isStory && (
          <>
            <Handle type="target" position={Position.Left} id="logo" style={{ top: "22%" }}
              className={cn(flowHandleClass, "!bg-tone-blue")} title="Logo" />
            <Handle type="target" position={Position.Left} id="refs" style={{ top: "50%" }}
              className={cn(flowHandleClass, "!bg-tone-violet")} title="Referências" />
          </>
        )}
        {isStory && (
          <Handle type="target" position={Position.Left} id="refs"
            className={cn(flowHandleClass, "!bg-tone-cyan")} title="Lista" />
        )}

        {/* Fundo: imagem (desfoca ao editar o prompt) */}
        <div className="absolute inset-0 overflow-hidden rounded-[calc(1.75rem-2px)]">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={data.label ?? ""}
              draggable={false}
              onDoubleClick={() => !promptOpen && setLightbox(true)}
              className={cn(
                "size-full cursor-zoom-in object-cover transition-[filter,transform] duration-300 ease-out",
                promptOpen && "scale-110 blur-2xl"
              )}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-neutral-800 to-neutral-950 pb-40 text-white/40">
              {isGenerating ? (
                <>
                  <Loader2 className="size-7 animate-spin text-white/70" />
                  <span className="text-xs font-medium text-white/70">
                    {status === "queued" ? "na fila…" : "gerando…"}
                  </span>
                </>
              ) : (
                <>
                  <ImageIcon className="size-7" strokeWidth={1.5} />
                  <span className="text-xs">{aspect}</span>
                </>
              )}
            </div>
          )}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 transition-colors duration-300",
              promptOpen
                ? "bg-black/55"
                : "bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35)_0%,transparent_22%,transparent_40%,rgba(0,0,0,0.88)_70%,rgba(0,0,0,0.95)_100%)]"
            )}
          />
          {isGenerating && current && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="size-7 animate-spin text-white/80" />
            </div>
          )}
        </div>

        {/* Overlay de UI */}
        <div className="pointer-events-none absolute inset-0 flex flex-col p-3.5 [&_button]:pointer-events-auto [&_textarea]:pointer-events-auto">
          {/* Pilha: uma miniatura por versão já gerada, cada uma com download próprio. */}
          {stack.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {stack.map((item, i) => (
                <div
                  key={item.versionId}
                  className={cn(
                    "group nodrag relative size-9 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                    i === safeIdx ? "border-primary" : "border-white/15 hover:border-white/40"
                  )}
                >
                  <button
                    type="button"
                    title={`Versão ${i + 1}`}
                    onClick={() => setIdx(i)}
                    className="absolute inset-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={`Versão ${i + 1}`} draggable={false} className="size-full object-cover" />
                  </button>
                  <button
                    type="button"
                    title="Baixar esta versão"
                    onClick={(e) => {
                      e.stopPropagation();
                      void downloadImageUrl(item.url, downloadFilename);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Download className="size-3.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Logo: posição + tamanho (só quando há logo conectada) */}
          {!isStory && hasLogo && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="flex h-8 items-center gap-1.5 rounded-full bg-black/40 px-2.5 text-[0.6875rem] font-semibold text-white/80 backdrop-blur-md">
                <ImageIcon className="size-3.5" /> Logo
              </span>
              <NodeSelect variant="glass" title="Posição da logo" value={logoPosition}
                options={LOGO_POSITIONS.map((p) => ({ value: p.value, label: p.label }))}
                onChange={(v) => {
                  update({ logoPosition: v });
                  applyLogoDirective(v, logoSize);
                }} />
              <button
                type="button"
                onClick={cycleLogoSize}
                title={`Tamanho da logo: ${LOGO_SIZES[logoSizeLevel]?.label ?? "Pequena"} (clique para alternar)`}
                className="nodrag flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                <span
                  className="shrink-0 rounded-full bg-current"
                  style={{ width: 5 + logoSizeLevel * 4, height: 5 + logoSizeLevel * 4 }}
                />
                <span className="text-[0.6875rem] font-semibold">
                  {LOGO_SIZES[logoSizeLevel]?.label ?? "Pequena"}
                </span>
              </button>
            </div>
          )}

          {/* Referências + prompt (expande ao editar) */}
          <div className="mt-3 flex min-h-0 flex-1 flex-col justify-end">
            <div className="mb-2.5 flex shrink-0 items-center gap-1.5">
              <button type="button" title="Mencionar referência"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startMention}
                className="nodrag flex size-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20">
                <Plus className="size-4" />
              </button>
              <button type="button" title="Escolher do acervo"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPickerOpen(true)}
                className="nodrag flex size-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20">
                <Library className="size-4" />
              </button>
              {mentionable.map((m) => (
                <button key={m.token} type="button" title={`Mencionar ${m.label}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertToken(m.token)}
                  className={cn(
                    "nodrag size-9 shrink-0 overflow-hidden rounded-xl border-2 bg-white/10 transition-colors",
                    draft.includes(m.token) ? "border-primary" : "border-transparent hover:border-white/40"
                  )}>
                  {m.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.label} draggable={false}
                      className={cn("size-full", m.label === "logo" ? "object-contain p-1" : "object-cover")} />
                  )}
                </button>
              ))}
            </div>

            <div className={cn("relative flex min-h-0 flex-col", promptOpen && "flex-1")}>
              {promptOpen ? (
                <textarea
                  ref={taRef}
                  autoFocus
                  value={draft}
                  placeholder={"Descreva a arte…\nHeadline: …\nSubheadline: …\nCTA: …"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft(v);
                    setMention(detectMention(v, e.target.selectionStart ?? v.length));
                    setMentionIdx(0);
                    scheduleCommit(v);
                  }}
                  onBlur={() => {
                    if (commitTimer.current) clearTimeout(commitTimer.current);
                    commit(draftRef.current, true);
                    setMention(null);
                    setPromptOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (showMention) {
                      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionOpts.length); return; }
                      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionOpts.length) % mentionOpts.length); return; }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        const o = mentionOpts[mentionIdx];
                        if (o && mention) pickMention(o.token, mention.query, mention.start);
                        return;
                      }
                      if (e.key === "Escape") { e.stopPropagation(); setMention(null); return; }
                    }
                    if (e.key === "Escape") { e.stopPropagation(); e.currentTarget.blur(); }
                  }}
                  className="nodrag nowheel min-h-0 w-full flex-1 resize-none bg-transparent pr-1 text-[0.875rem] leading-relaxed text-white placeholder:text-white/40 focus:outline-none [scrollbar-color:rgba(255,255,255,0.3)_transparent] [scrollbar-width:thin]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => openEditor(draft)}
                  title="Editar prompt"
                  className="nodrag line-clamp-3 w-full text-left text-[0.875rem] leading-relaxed text-white/95"
                >
                  {draft.trim() ? <PromptPreview text={draft} linked={linkedTokens} /> : <span className="text-white/45">Descreva a arte…</span>}
                </button>
              )}

              {showMention && (
                <div className="nodrag nopan pointer-events-auto absolute bottom-full left-0 z-50 mb-1 w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/95 p-1 shadow-2xl backdrop-blur-md">
                  {mentionOpts.map((o, i) => (
                    <button key={o.token} type="button"
                      onMouseDown={(e) => { e.preventDefault(); if (mention) pickMention(o.token, mention.query, mention.start); }}
                      className={cn("flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left", i === mentionIdx ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10")}>
                      {o.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.url} alt="" className="size-6 rounded-md bg-white/10 object-cover" />
                      )}
                      <span className="text-xs font-semibold">@{o.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Controles */}
          <div className="pointer-events-auto mt-3 flex shrink-0 flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <div className="flex h-8 items-center rounded-full bg-white/10 px-1 text-xs font-semibold backdrop-blur-md">
                <button type="button" title="Menos" disabled={count <= 1}
                  onClick={() => update({ count: Math.max(1, count - 1) })}
                  className={glassIconBtn}>
                  <Minus className="size-3.5" />
                </button>
                <span className="w-7 text-center tabular-nums">x{count}</span>
                <button type="button" title="Mais" disabled={count >= MAX_COUNT}
                  onClick={() => update({ count: Math.min(MAX_COUNT, count + 1) })}
                  className={glassIconBtn}>
                  <Plus className="size-3.5" />
                </button>
              </div>
              <NodeSelect variant="glass" title="Formato" value={aspect}
                leading={<AspectGlyph aspect={aspect} />}
                options={ASPECT_OPTIONS.map((v) => ({ value: v, label: v }))}
                onChange={(v) => update({ aspectRatio: v })} />
              <NodeSelect variant="glass" title="Resolução" value={data.imageSize ?? "2K"}
                options={SIZE_OPTIONS.map((v) => ({ value: v, label: v }))}
                onChange={(v) => update({ imageSize: v })} />
            </div>
            <div className="flex items-center gap-1.5">
              <NodeSelect variant="glass" title={isStory ? "Esforço (stories: sempre Low)" : "Esforço"}
                value={isStory ? STORY_QUALITY : data.quality ?? "medium"}
                leading={<Gauge className="size-3.5 text-white/70" />}
                options={(isStory ? [STORY_QUALITY] : QUALITY_OPTIONS).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
                onChange={(v) => update({ quality: v as ArteData["quality"] })} />
              <div className="ml-auto">
                {isGenerating ? (
                  <button type="button" onClick={handlePause} title="Pausar geração"
                    className="nodrag flex size-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-red-500/80">
                    <Pause className="size-4 fill-current" />
                  </button>
                ) : (
                  <button type="button" onClick={handleGenerate} disabled={triggering}
                    title={current ? "Gerar novamente" : "Gerar"}
                    className="nodrag flex size-9 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg transition-transform hover:scale-105 disabled:opacity-60">
                    {triggering ? <Loader2 className="size-4 animate-spin" />
                      : current ? <RefreshCw className="size-4" strokeWidth={2.25} />
                      : <Sparkles className="size-4" strokeWidth={2.25} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <Handle type="source" position={Position.Right} className={flowHandleClass} />
      </div>

      {lightbox && current && <ImageLightbox url={current.url} onClose={() => setLightbox(false)} />}

      {pickerOpen && (
        <LibraryPickerDialog
          demandId={data.demandId ?? ""}
          arteIndex={data.artIndex}
          onClose={() => setPickerOpen(false)}
          onPick={addLibraryReference}
        />
      )}

      {driveOpen && current && (
        <SendToDriveDialog
          sourceUrl={current.url}
          currentDemandId={data.demandId}
          onClose={() => setDriveOpen(false)}
        />
      )}

      {previewOpen && data.demandId && (
        <GenerationPreviewDialog
          demandId={data.demandId}
          artIndex={data.artIndex}
          prepare={saveNow}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
