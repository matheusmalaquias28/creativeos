"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  CaseSensitive,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  MousePointerClick,
  Palette,
  Plus,
  Save,
  Sparkles,
  Stamp,
  Trash2,
  Type,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  SlidePreview,
  FORMAT_LABELS,
  FORMAT_DIMENSIONS,
} from "@/components/carousel/slide-preview";
import {
  SidebarSection,
  RangeControl,
  ModernColorPicker,
  FontPicker,
  controlLabelClass,
} from "@/components/carousel/controls/pickers";
import { RichTextField } from "@/components/carousel/rich-text-field";
import { CtaControls } from "@/components/carousel/controls/cta-controls";
import { DesignControls } from "@/components/carousel/controls/design-controls";
import { ImageGridControls } from "@/components/carousel/controls/image-grid-controls";
import { BackgroundGenerator } from "@/components/carousel/controls/bg-generator";
import { RegenerateImageButton } from "@/components/carousel/controls/regenerate-image-button";
import { FORMAT_ASPECT } from "@/lib/carousel/generate-image-client";
import { DEFAULT_FONT_FAMILY } from "@/lib/design/fonts";
import { saveCarouselAction } from "@/actions/carousels";
import {
  makeDefaultSlide,
  makeDefaultCta,
  makeDefaultDesign,
  makeDefaultImageGrid,
} from "@/types/carousel";
import type {
  Carousel,
  CarouselCta,
  CarouselDesign,
  CarouselImageGrid,
  CarouselFormat,
  CarouselSlide,
  PostStyle,
  TextPosition,
} from "@/types/carousel";

// ─── Constants ───────────────────────────────────────────────────────────────

type PostStyleDef = {
  id: PostStyle;
  label: string;
  desc: string;
};

const POST_STYLES: PostStyleDef[] = [
  { id: "minimal", label: "Minimal", desc: "Limpo, foco no texto" },
  { id: "profile", label: "Profile", desc: "Com destaque de perfil" },
  { id: "creator", label: "Creator", desc: "Estilo creator/influencer" },
  { id: "techviral", label: "TechViral", desc: "Tech agressivo e viral" },
  { id: "viralsaas", label: "Viral SaaS", desc: "Clean com acento moderno" },
];

const TEXT_POSITIONS: TextPosition[] = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

const POSITION_DOT: Record<TextPosition, string> = {
  "top-left": "items-start justify-start",
  "top-center": "items-start justify-center",
  "top-right": "items-start justify-end",
  "middle-left": "items-center justify-start",
  "middle-center": "items-center justify-center",
  "middle-right": "items-center justify-end",
  "bottom-left": "items-end justify-start",
  "bottom-center": "items-end justify-center",
  "bottom-right": "items-end justify-end",
};

// ─── Color extraction ─────────────────────────────────────────────────────────

async function extractColors(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const SIZE = 120;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve([]); return; }
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;

      const Q = 28;
      const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue;
        const r = Math.round(pixels[i] / Q) * Q;
        const g = Math.round(pixels[i + 1] / Q) * Q;
        const b = Math.round(pixels[i + 2] / Q) * Q;
        const key = (r << 16) | (g << 8) | b;
        const e = buckets.get(key);
        if (e) e.count++;
        else buckets.set(key, { count: 1, r, g, b });
      }

      const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
      const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
      const dist = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
        Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

      const result: typeof sorted = [];
      for (const c of sorted) {
        if (result.length >= 6) break;
        if (result.every((x) => dist(x, c) > 55)) result.push(c);
      }

      URL.revokeObjectURL(url);
      resolve(result.map(({ r, g, b }) => `#${toHex(r)}${toHex(g)}${toHex(b)}`));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve([]); };
    img.src = url;
  });
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Color extraction from image
function ViaImagemExtractor({
  onApply,
}: {
  onApply: (fundo: string, titulo: string, subtitulo: string) => void;
}) {
  const [colors, setColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const extracted = await extractColors(file);
    setColors(extracted);
    setLoading(false);

    if (extracted.length >= 3) {
      const sorted = [...extracted].sort((a, b) => luminance(a) - luminance(b));
      onApply(sorted[0], sorted[sorted.length - 1], sorted[Math.floor(sorted.length / 2)]);
      toast.success("Cores aplicadas automaticamente — ajuste conforme necessário");
    }
  }

  return (
    <div className="space-y-3">
      <label className={cn(
        "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-3",
        "border-border-strong bg-surface text-xs font-semibold text-muted-foreground transition-colors",
        "hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
      )}>
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ImagePlus className="size-3.5" />
        )}
        {loading ? "Extraindo cores..." : "Carregar logo ou imagem da marca"}
      </label>

      {colors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Cores extraídas — clique para aplicar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((c) => (
              <div key={c} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => onApply(c, c, c)}
                  title={`Aplicar ${c}`}
                  className="size-8 rounded-lg border-2 border-border-strong shadow-[var(--surface-shadow)] transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                />
                <span className="font-mono text-[0.625rem] text-muted-foreground">{c}</span>
              </div>
            ))}
          </div>
          <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
            As cores mais escura, clara e média foram aplicadas automaticamente como Fundo, Título e Subtítulo.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

type OpenSections = Record<string, boolean>;

const INITIAL_SECTIONS: OpenSections = {
  estilo: true,
  ai: true,
  texto: true,
  cores: false,
  tipografia: false,
  cta: false,
  grade: false,
  marca: false,
  imagem: false,
};

/** Merge a (possibly partial/legacy) design object from the DB with defaults. */
function normalizeDesign(design?: CarouselDesign | null): CarouselDesign {
  const base = makeDefaultDesign();
  if (!design || typeof design !== "object") return base;
  return {
    badge: { ...base.badge, ...design.badge },
    numbering: { ...base.numbering, ...design.numbering },
    pagination: { ...base.pagination, ...design.pagination },
  };
}

export function CarouselEditor({
  initial,
  turboGenerating = false,
  turboExpectedImages,
}: {
  initial: Carousel;
  turboGenerating?: boolean;
  turboExpectedImages?: number;
}) {
  const [carousel, setCarousel] = useState<Carousel>({
    ...initial,
    post_style: initial.post_style ?? "minimal",
    design: normalizeDesign(initial.design),
  });
  const [bgGenerating, setBgGenerating] = useState(turboGenerating);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [sections, setSections] = useState(INITIAL_SECTIONS);
  const [colorTab, setColorTab] = useState<"manual" | "imagem">("manual");
  const [saving, setSaving] = useState(false);

  const [aiPrompt, setAiPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [improveInstruction, setImproveInstruction] = useState("");

  const [refineInstruction, setRefineInstruction] = useState("");
  const [refining, setRefining] = useState(false);

  const [caption, setCaption] = useState<string | null>(null);
  const [captionLoading, setCaptionLoading] = useState(false);

  const slideRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [viewportW, setViewportW] = useState(1200);

  const currentSlide = carousel.slides[currentIdx] ?? carousel.slides[0];
  // Show ~2.5 cards at once, as large as the canvas allows.
  const slideWidth = Math.max(240, Math.floor((viewportW - 48) / 2.5) - 16);

  // Track the canvas width so cards resize to keep ~2.5 visible.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => setViewportW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Turbo background image generation watcher ───────────────────────────────
  // When we arrive from the Gerador Turbo mid-generation, the server keeps
  // producing images and persisting them. Poll and merge only into empty image
  // slots so live edits are preserved, until all expected images arrive or a
  // safety timeout elapses.
  useEffect(() => {
    if (!turboGenerating) return;
    const supabase = createBrowserClient();
    let active = true;

    const countImages = (slides: CarouselSlide[]) =>
      slides.reduce((n, s) => {
        let c = s.imagemFundo ? 1 : 0;
        if (s.imageGrid?.enabled) c += s.imageGrid.images.filter(Boolean).length;
        return n + c;
      }, 0);

    const merge = (dbSlides: CarouselSlide[]) => {
      setCarousel((c) => {
        const byId = new Map(dbSlides.map((s) => [s.id, s]));
        let changed = false;
        const slides = c.slides.map((s) => {
          const db = byId.get(s.id);
          if (!db) return s;
          let ns = s;
          if (!s.imagemFundo && db.imagemFundo) {
            ns = { ...ns, imagemFundo: db.imagemFundo, overlayOpacidade: db.overlayOpacidade ?? ns.overlayOpacidade };
            changed = true;
          }
          if (s.imageGrid?.enabled && db.imageGrid?.images?.length) {
            const merged = s.imageGrid.images.map((img, i) => img ?? db.imageGrid!.images[i] ?? null);
            if (merged.some((v, i) => v !== s.imageGrid!.images[i])) {
              ns = { ...ns, imageGrid: { ...s.imageGrid, images: merged } };
              changed = true;
            }
          }
          return ns;
        });
        return changed ? { ...c, slides } : c;
      });
    };

    const finish = () => {
      if (!active) return;
      active = false;
      clearInterval(iv);
      clearTimeout(to);
      setBgGenerating(false);
    };

    const poll = async () => {
      const { data } = await supabase
        .from("carousels")
        .select("slides")
        .eq("id", initial.id)
        .single();
      if (!active || !data) return;
      const dbSlides = ((data.slides as CarouselSlide[]) ?? []);
      merge(dbSlides);
      if (turboExpectedImages && countImages(dbSlides) >= turboExpectedImages) {
        finish();
      }
    };

    const iv = setInterval(poll, 4000);
    const to = setTimeout(finish, 210_000);
    poll();

    return () => {
      active = false;
      clearInterval(iv);
      clearTimeout(to);
    };
  }, [turboGenerating, initial.id, turboExpectedImages]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const toggleSection = useCallback((id: string) => {
    setSections((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  function updateSlide(patch: Partial<CarouselSlide>, idx = currentIdx) {
    setCarousel((c) => ({
      ...c,
      slides: c.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function updateCarousel(patch: Partial<Carousel>) {
    setCarousel((c) => ({ ...c, ...patch }));
  }

  const design = carousel.design ?? makeDefaultDesign();

  function updateDesign(patch: Partial<CarouselDesign>) {
    setCarousel((c) => ({
      ...c,
      design: { ...normalizeDesign(c.design), ...patch },
    }));
  }

  function updateCta(patch: Partial<CarouselCta>) {
    const nextCta = { ...(currentSlide?.cta ?? makeDefaultCta()), ...patch };
    updateSlide({ cta: nextCta });
  }

  function updateImageGrid(patch: Partial<CarouselImageGrid>) {
    const next = { ...(currentSlide?.imageGrid ?? makeDefaultImageGrid()), ...patch };
    updateSlide({ imageGrid: next });
  }

  function selectSlide(idx: number) {
    setCurrentIdx(idx);
    setSections((s) => ({ ...s, texto: true }));
  }

  // ─── Slide management ──────────────────────────────────────────────────────

  function addSlide() {
    if (carousel.slides.length >= 20) { toast.error("Máximo de 20 slides"); return; }
    const base = currentSlide;
    const newSlide = makeDefaultSlide({
      corFundo: base?.corFundo ?? "#0a0a0a",
      corTitulo: base?.corTitulo ?? "#ffffff",
      corSubtitulo: base?.corSubtitulo ?? "#a3a3a3",
      tamanhoTitulo: base?.tamanhoTitulo ?? 96,
      tamanhoSubtitulo: base?.tamanhoSubtitulo ?? 40,
    });
    const nextIdx = carousel.slides.length;
    setCarousel((c) => ({ ...c, slides: [...c.slides, newSlide] }));
    setCurrentIdx(nextIdx);
  }

  function removeSlide() {
    if (carousel.slides.length <= 1) { toast.error("Precisa ter ao menos 1 slide"); return; }
    setCarousel((c) => ({ ...c, slides: c.slides.filter((_, i) => i !== currentIdx) }));
    setCurrentIdx((i) => Math.min(i, carousel.slides.length - 2));
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const result = await saveCarouselAction(carousel);
    setSaving(false);
    if (result.error) toast.error(result.error);
    else toast.success("Carrossel salvo");
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    // Export from the off-screen full-size (1:1, unscaled) render for a crisp,
    // card-only image at maximum quality.
    const node = exportRef.current;
    if (!node) return;
    const dims = FORMAT_DIMENSIONS[carousel.format];
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        width: dims.width,
        height: dims.height,
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${carousel.name || "slide"}-${currentIdx + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Falha ao exportar a imagem");
    }
  }

  // ─── AI ────────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!aiPrompt.trim()) { toast.error("Descreva o tema"); return; }
    setAiGenerating(true);
    try {
      const res = await fetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "slides", prompt: aiPrompt, slideCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const base = currentSlide;
      const newSlides: CarouselSlide[] = data.slides.map(
        (s: { titulo: string; subtitulo: string }) =>
          makeDefaultSlide({
            titulo: s.titulo,
            subtitulo: s.subtitulo,
            corFundo: base?.corFundo ?? "#0a0a0a",
            corTitulo: base?.corTitulo ?? "#ffffff",
            corSubtitulo: base?.corSubtitulo ?? "#a3a3a3",
          })
      );
      setCarousel((c) => ({ ...c, slides: newSlides }));
      setCurrentIdx(0);
      toast.success(`${newSlides.length} slides gerados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na geração");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleImprove() {
    if (!improveInstruction.trim()) { toast.error("Descreva o que melhorar"); return; }
    setAiGenerating(true);
    try {
      const res = await fetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "improve",
          slides: carousel.slides.map((s) => ({ titulo: s.titulo, subtitulo: s.subtitulo })),
          instruction: improveInstruction,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCarousel((c) => ({
        ...c,
        slides: c.slides.map((s, i) => ({
          ...s,
          titulo: data.slides[i]?.titulo ?? s.titulo,
          subtitulo: data.slides[i]?.subtitulo ?? s.subtitulo,
        })),
      }));
      toast.success("Conteúdo melhorado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleRefine() {
    if (!refineInstruction.trim()) { toast.error("Descreva o que refinar"); return; }
    setRefining(true);
    try {
      const res = await fetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "refine",
          slide: { titulo: currentSlide.titulo, subtitulo: currentSlide.subtitulo },
          instruction: refineInstruction,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateSlide({ titulo: data.titulo, subtitulo: data.subtitulo });
      setRefineInstruction("");
      toast.success("Slide refinado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setRefining(false);
    }
  }

  async function handleCaption() {
    setCaptionLoading(true);
    try {
      const res = await fetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "caption",
          slides: carousel.slides.map((s) => ({ titulo: s.titulo, subtitulo: s.subtitulo })),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCaption(data.caption);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setCaptionLoading(false);
    }
  }

  // ─── Image upload for background ────────────────────────────────────────────

  function handleBgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("Imagem muito grande (máx 25 MB)"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { updateSlide({ imagemFundo: ev.target?.result as string }); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const slideBadge = (
    <Badge variant="outline" className="shrink-0 tabular-nums">
      Slide {currentIdx + 1}
    </Badge>
  );
  const applyAllClass =
    "text-[0.6875rem] font-semibold text-muted-foreground transition-colors hover:text-primary";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">

      {/* ── Header bar ── */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-sidebar px-4">
        {/* Left */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/carousel"
            className="group inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            Carrosséis
          </Link>
          <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
          <input
            value={carousel.name}
            onChange={(e) => updateCarousel({ name: e.target.value })}
            aria-label="Nome do carrossel"
            className="h-8 min-w-0 max-w-[240px] rounded-lg border border-transparent bg-transparent px-2 text-sm font-bold tracking-tight text-foreground outline-none transition-premium placeholder:text-muted-foreground/70 hover:border-border focus:border-primary/60 focus:bg-input"
            placeholder="Nome do carrossel"
          />
        </div>

        {/* Center: slide nav */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-surface p-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Slide anterior"
            onClick={() => selectSlide(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-[5.5rem] text-center text-xs font-semibold tabular-nums text-foreground">
            Slide {currentIdx + 1} / {carousel.slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Próximo slide"
            onClick={() => selectSlide(Math.min(carousel.slides.length - 1, currentIdx + 1))}
            disabled={currentIdx === carousel.slides.length - 1}
          >
            <ChevronRight />
          </Button>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon-xs" onClick={addSlide} title="Adicionar slide" aria-label="Adicionar slide">
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={removeSlide}
            title="Remover slide"
            aria-label="Remover slide"
            className="hover:bg-tone-red/12 hover:text-tone-red"
          >
            <Trash2 />
          </Button>
        </div>

        {/* Right */}
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCaption} disabled={captionLoading}>
            {captionLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Legenda
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download />
            Baixar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar
          </Button>
        </div>
      </header>

      {/* ── Body: sidebar + canvas ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <aside className="flex w-80 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-surface p-3">

          {/* Format selector */}
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-[var(--surface-shadow)]">
            <p className="text-[0.8125rem] font-semibold text-foreground">Formato</p>
            <div role="tablist" aria-label="Formato do carrossel" className="grid grid-cols-3 gap-0.5 rounded-xl border border-border bg-surface p-1">
              {(["carousel", "square", "stories"] as CarouselFormat[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={carousel.format === f}
                  onClick={() => updateCarousel({ format: f })}
                  className={cn(
                    "h-7 rounded-lg px-2 text-xs font-semibold transition-premium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    carousel.format === f
                      ? "bg-card text-foreground shadow-[var(--surface-shadow),var(--inner-highlight)] ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {FORMAT_LABELS[f].split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Estilo do Post */}
          <SidebarSection title="Estilo do post" icon={<LayoutTemplate />} open={!!sections.estilo} onToggle={() => toggleSection("estilo")}>
            <div className="grid grid-cols-1 gap-1.5">
              {POST_STYLES.map((style) => {
                const active = carousel.post_style === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => updateCarousel({ post_style: style.id })}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-premium",
                      active
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-accent"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card"
                      )}
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0">
                      <p className={cn("text-xs font-semibold", active ? "text-foreground" : "text-foreground/80")}>
                        {style.label}
                      </p>
                      <p className="truncate text-[0.6875rem] text-muted-foreground">{style.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
              Os layouts de cada estilo serão construídos em breve.
            </p>
          </SidebarSection>

          {/* Gerar com IA */}
          <SidebarSection title="Gerar com IA" icon={<Sparkles />} open={!!sections.ai} onToggle={() => toggleSection("ai")}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Do zero</p>
              <Textarea
                placeholder="Ex: Como dobrar suas vendas no Instagram em 30 dias"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="min-h-0 resize-none text-xs"
                rows={3}
              />
              <RangeControl label="Quantidade de slides" value={slideCount} min={1} max={20} unit="" onChange={setSlideCount} />
              <Button size="sm" className="w-full" onClick={handleGenerate} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {aiGenerating ? "Gerando..." : `Gerar ${slideCount} slides`}
              </Button>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold text-foreground">Melhorar atual</p>
              <Textarea
                placeholder='Ex: "Deixe os títulos mais curtos e diretos"'
                value={improveInstruction}
                onChange={(e) => setImproveInstruction(e.target.value)}
                className="min-h-0 resize-none text-xs"
                rows={2}
              />
              <Button variant="outline" size="sm" className="w-full" onClick={handleImprove} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Melhorar conteúdo
              </Button>
            </div>
          </SidebarSection>

          {/* Texto */}
          <SidebarSection title="Texto" icon={<Type />} badge={slideBadge} open={!!sections.texto} onToggle={() => toggleSection("texto")}>
            <FontPicker
              label="Fonte do slide"
              value={currentSlide?.fonteFamilia ?? DEFAULT_FONT_FAMILY}
              onChange={(family) => updateSlide({ fonteFamilia: family })}
            />
            <div className="-mt-2 flex justify-end">
              <button
                onClick={() => {
                  const family = currentSlide?.fonteFamilia ?? DEFAULT_FONT_FAMILY;
                  setCarousel((c) => ({
                    ...c,
                    slides: c.slides.map((s) => ({ ...s, fonteFamilia: family })),
                  }));
                  toast.success("Fonte aplicada em todos os slides");
                }}
                className={applyAllClass}
              >
                Aplicar fonte em todos
              </button>
            </div>

            {/* Posição do bloco de texto */}
            <div className="space-y-1.5">
              <label className={controlLabelClass}>Posição do texto</label>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1">
                {TEXT_POSITIONS.map((p) => {
                  const active = (currentSlide?.textPos ?? "bottom-left") === p;
                  return (
                    <button
                      key={p}
                      onClick={() => updateSlide({ textPos: p })}
                      title={p}
                      aria-pressed={active}
                      className={cn(
                        "flex aspect-[4/3] rounded-lg border p-1.5 transition-colors",
                        POSITION_DOT[p],
                        active
                          ? "border-primary/50 bg-primary/12"
                          : "border-transparent hover:bg-accent"
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground/50")} />
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const textPos = currentSlide?.textPos ?? "bottom-left";
                    setCarousel((c) => ({
                      ...c,
                      slides: c.slides.map((s) => ({ ...s, textPos })),
                    }));
                    toast.success("Posição aplicada em todos os slides");
                  }}
                  className={applyAllClass}
                >
                  Aplicar posição em todos
                </button>
              </div>
            </div>

            {/* Glassmorphism */}
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="text-xs font-medium text-foreground">Retângulo glassmorphism</span>
              <input
                type="checkbox"
                checked={currentSlide?.textGlass ?? false}
                onChange={(e) => updateSlide({ textGlass: e.target.checked })}
                className="size-4 cursor-pointer accent-primary"
              />
            </label>

            <div className="space-y-1.5">
              <label className={controlLabelClass}>Título</label>
              <RichTextField
                key={`titulo-${currentSlide?.id}`}
                html={currentSlide?.tituloHtml}
                plain={currentSlide?.titulo ?? ""}
                placeholder="Título do slide"
                rows={2}
                onChange={({ html, plain }) => updateSlide({ tituloHtml: html, titulo: plain })}
              />
            </div>
            <div className="space-y-1.5">
              <label className={controlLabelClass}>Subtítulo</label>
              <RichTextField
                key={`subtitulo-${currentSlide?.id}`}
                html={currentSlide?.subtituloHtml}
                plain={currentSlide?.subtitulo ?? ""}
                placeholder="Subtítulo ou frase de apoio"
                rows={2}
                onChange={({ html, plain }) => updateSlide({ subtituloHtml: html, subtitulo: plain })}
              />
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold text-foreground">Refinar com IA</p>
              <Textarea
                placeholder='Ex: "Torne mais direto e adicione dado estatístico"'
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                className="min-h-0 resize-none text-xs"
                rows={2}
              />
              <Button variant="outline" size="sm" className="w-full" onClick={handleRefine} disabled={refining}>
                {refining ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Refinar este slide
              </Button>
            </div>
          </SidebarSection>

          {/* Cores */}
          <SidebarSection title="Cores" icon={<Palette />} badge={slideBadge} open={!!sections.cores} onToggle={() => toggleSection("cores")}>
            <SegmentedControl
              aria-label="Modo de cores"
              size="sm"
              value={colorTab}
              onChange={setColorTab}
              className="grid w-full grid-cols-2"
              options={[
                { value: "manual", label: "Manual" },
                { value: "imagem", label: "Via imagem" },
              ]}
            />

            {colorTab === "manual" ? (
              <>
                {/* Valores padrão abaixo = cores de conteúdo do slide */}
                <ModernColorPicker
                  label="Fundo"
                  value={currentSlide?.corFundo ?? "#0a0a0a"}
                  onChange={(v) => updateSlide({ corFundo: v })}
                />
                <ModernColorPicker
                  label="Título"
                  value={currentSlide?.corTitulo ?? "#ffffff"}
                  onChange={(v) => updateSlide({ corTitulo: v })}
                />
                <ModernColorPicker
                  label="Subtítulo"
                  value={currentSlide?.corSubtitulo ?? "#a3a3a3"}
                  onChange={(v) => updateSlide({ corSubtitulo: v })}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const { corFundo, corTitulo, corSubtitulo } = currentSlide;
                    setCarousel((c) => ({
                      ...c,
                      slides: c.slides.map((s) => ({ ...s, corFundo, corTitulo, corSubtitulo })),
                    }));
                    toast.success("Cores aplicadas em todos os slides");
                  }}
                >
                  Aplicar em todos os slides
                </Button>
              </>
            ) : (
              <ViaImagemExtractor
                onApply={(fundo, titulo, subtitulo) => {
                  updateSlide({ corFundo: fundo, corTitulo: titulo, corSubtitulo: subtitulo });
                }}
              />
            )}
          </SidebarSection>

          {/* Tipografia */}
          <SidebarSection title="Tipografia" icon={<CaseSensitive />} badge={slideBadge} open={!!sections.tipografia} onToggle={() => toggleSection("tipografia")}>
            <RangeControl
              label="Tamanho do título"
              value={currentSlide?.tamanhoTitulo ?? 96}
              min={32}
              max={200}
              onChange={(v) => updateSlide({ tamanhoTitulo: v })}
            />
            <RangeControl
              label="Tamanho do subtítulo"
              value={currentSlide?.tamanhoSubtitulo ?? 40}
              min={16}
              max={80}
              onChange={(v) => updateSlide({ tamanhoSubtitulo: v })}
            />
          </SidebarSection>

          {/* CTA */}
          <SidebarSection title="Botão / CTA" icon={<MousePointerClick />} badge={slideBadge} open={!!sections.cta} onToggle={() => toggleSection("cta")}>
            <CtaControls cta={currentSlide?.cta ?? makeDefaultCta()} onChange={updateCta} />
            {currentSlide?.cta?.enabled && (
              <button
                onClick={() => {
                  const cta = currentSlide.cta;
                  setCarousel((c) => ({
                    ...c,
                    slides: c.slides.map((s) => ({ ...s, cta: cta ? { ...cta } : s.cta })),
                  }));
                  toast.success("CTA aplicado em todos os slides");
                }}
                className={cn(applyAllClass, "w-full")}
              >
                Aplicar este CTA em todos os slides
              </button>
            )}
          </SidebarSection>

          {/* Grade de imagens */}
          <SidebarSection title="Grade de imagens" icon={<LayoutGrid />} badge={slideBadge} open={!!sections.grade} onToggle={() => toggleSection("grade")}>
            <ImageGridControls
              grid={currentSlide?.imageGrid ?? makeDefaultImageGrid()}
              onChange={updateImageGrid}
            />
          </SidebarSection>

          {/* Marca & Layout (carousel-level) */}
          <SidebarSection title="Marca e layout" icon={<Stamp />} open={!!sections.marca} onToggle={() => toggleSection("marca")}>
            <p className="-mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
              Aplicado a todos os slides do carrossel.
            </p>
            <DesignControls design={design} onChange={updateDesign} />
          </SidebarSection>

          {/* Imagem de fundo */}
          <SidebarSection title="Imagem de fundo" icon={<ImageIcon />} badge={slideBadge} open={!!sections.imagem} onToggle={() => toggleSection("imagem")}>
            <label className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-xs font-semibold transition-colors",
              currentSlide?.imagemFundo
                ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                : "border-border-strong bg-surface text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
            )}>
              <input type="file" accept="image/*" className="sr-only" onChange={handleBgImageUpload} />
              <ImagePlus className="size-3.5" />
              {currentSlide?.imagemFundo ? "Trocar imagem" : "Carregar imagem (máx 25 MB)"}
            </label>

            {currentSlide?.bgPrompt && !currentSlide?.imageGrid?.enabled && (
              <RegenerateImageButton
                prompt={currentSlide.bgPrompt}
                aspect={FORMAT_ASPECT[carousel.format]}
                onDone={(url) =>
                  updateSlide({ imagemFundo: url, overlayOpacidade: currentSlide.overlayOpacidade || 55 })
                }
              />
            )}

            <BackgroundGenerator
              format={carousel.format}
              onApply={(url) => updateSlide({ imagemFundo: url })}
            />

            {currentSlide?.imagemFundo && (
              <>
                {/* Preview strip */}
                <div className="relative w-full overflow-hidden rounded-xl border border-border" style={{ height: 70 }}>
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${currentSlide.imagemFundo})`,
                      backgroundSize: `${currentSlide.imagemZoom ?? 150}%`,
                      backgroundPosition: `${currentSlide.imagemPosX ?? 50}% ${currentSlide.imagemPosY ?? 50}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                </div>

                <RangeControl
                  label="Zoom"
                  value={currentSlide.imagemZoom ?? 150}
                  min={80}
                  max={400}
                  unit="%"
                  onChange={(v) => updateSlide({ imagemZoom: v })}
                />
                <RangeControl
                  label="Posição horizontal"
                  value={currentSlide.imagemPosX ?? 50}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateSlide({ imagemPosX: v })}
                />
                <RangeControl
                  label="Posição vertical"
                  value={currentSlide.imagemPosY ?? 50}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateSlide({ imagemPosY: v })}
                />
                <RangeControl
                  label="Opacidade do overlay"
                  value={currentSlide.overlayOpacidade ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateSlide({ overlayOpacidade: v })}
                />
                <RangeControl
                  label="Altura do overlay"
                  value={currentSlide.overlayHeight ?? 60}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateSlide({ overlayHeight: v })}
                />
                <ModernColorPicker
                  label="Cor do overlay"
                  value={currentSlide.overlayColor ?? "#000000"}
                  onChange={(v) => updateSlide({ overlayColor: v })}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => updateSlide({ imagemFundo: null, overlayOpacidade: 0, overlayHeight: 60, overlayColor: "#000000", imagemPosX: 50, imagemPosY: 50, imagemZoom: 150 })}
                >
                  Remover imagem
                </Button>
              </>
            )}
          </SidebarSection>
        </aside>

        {/* ── Canvas: horizontal slide strip ── */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
          <div aria-hidden className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60" />

          {/* Horizontal strip */}
          <div
            ref={stripRef}
            className="relative flex flex-1 items-start gap-5 overflow-x-auto overflow-y-auto overscroll-contain px-6 pt-7 pb-8"
            style={{ scrollbarWidth: "thin" }}
          >
            {carousel.slides.map((slide, i) => {
              const isActive = i === currentIdx;
              return (
                <div
                  key={slide.id}
                  className="flex shrink-0 flex-col gap-2"
                  style={{ width: slideWidth }}
                >
                  <button
                    // Evita o foco roubar o scroll do strip (a tela "descia" ao clicar).
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSlide(i)}
                    aria-label={`Selecionar slide ${i + 1}`}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "relative overflow-hidden rounded-2xl transition-all duration-200 focus:outline-none",
                      isActive
                        ? "scale-[1.02] shadow-[var(--surface-shadow-elevated)] ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "opacity-70 ring-1 ring-border hover:scale-[1.01] hover:opacity-100 hover:ring-border-strong"
                    )}
                  >
                    <SlidePreview
                      slide={slide}
                      format={carousel.format}
                      design={design}
                      index={i}
                      total={carousel.slides.length}
                      previewWidth={slideWidth}
                      innerRef={isActive ? slideRef : undefined}
                    />
                  </button>
                  {/* Slide number + label */}
                  <div className="flex items-center justify-between px-0.5">
                    <span className={cn("text-xs font-semibold tabular-nums", isActive ? "text-primary" : "text-muted-foreground")}>
                      Slide {i + 1}
                    </span>
                    {isActive && (
                      <Badge variant="violet">Editando</Badge>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add slide */}
            <button
              onClick={addSlide}
              className={cn(
                "flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-strong bg-surface/60 transition-colors hover:border-primary/50 hover:bg-primary/5",
                "text-muted-foreground hover:text-primary"
              )}
              style={{
                width: slideWidth * 0.55,
                height: (slideWidth * 0.55 * FORMAT_DIMENSIONS[carousel.format].height) / FORMAT_DIMENSIONS[carousel.format].width,
                marginTop: 0,
              }}
            >
              <Plus className="size-5" />
              <span className="text-xs font-semibold">Novo slide</span>
            </button>
          </div>

          {/* Footer info bar */}
          <div className="relative flex h-9 shrink-0 items-center justify-between border-t border-border bg-sidebar px-6 text-[0.6875rem] text-muted-foreground">
            <span className="tabular-nums">
              {FORMAT_LABELS[carousel.format]} · {FORMAT_DIMENSIONS[carousel.format].width}×{FORMAT_DIMENSIONS[carousel.format].height}px
            </span>
            <span className="tabular-nums">
              {carousel.slides.length} slide{carousel.slides.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Off-screen full-size render used for high-quality export ── */}
      <div
        aria-hidden
        style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}
      >
        {currentSlide && (
          <SlidePreview
            slide={currentSlide}
            format={carousel.format}
            design={design}
            index={currentIdx}
            total={carousel.slides.length}
            previewWidth={FORMAT_DIMENSIONS[carousel.format].width}
            innerRef={exportRef}
          />
        )}
      </div>

      {/* ── Turbo background-generation banner ── */}
      {bgGenerating && (
        <div className="animate-in-soft fixed right-5 bottom-5 z-50 flex items-center gap-3 rounded-2xl border border-tone-pink/25 bg-popover px-4 py-3 text-popover-foreground shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tone-pink opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-tone-pink" />
          </span>
          <div>
            <p className="text-[0.8125rem] font-semibold text-foreground">Gerando imagens em segundo plano…</p>
            <p className="text-xs text-muted-foreground">
              As artes aparecem nos cards conforme ficam prontas.
            </p>
          </div>
          <Loader2 className="size-4 animate-spin text-tone-pink" />
        </div>
      )}

      {/* ── Caption modal ── */}
      <Dialog open={!!caption} onOpenChange={(open) => { if (!open) setCaption(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legenda gerada</DialogTitle>
            <DialogDescription>Legenda e hashtags para o Instagram</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea
              value={caption ?? ""}
              onChange={(e) => setCaption(e.target.value)}
              rows={10}
              aria-label="Legenda"
              className="font-mono text-sm"
            />
          </DialogBody>
          <DialogFooter className="justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(caption ?? ""); toast.success("Copiado!"); }}
            >
              <Copy />
              Copiar
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCaption} disabled={captionLoading}>
                {captionLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Regerar
              </Button>
              <Button size="sm" onClick={() => setCaption(null)}>Fechar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
