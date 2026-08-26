"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Download,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  ImagePlus,
  Pipette,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  SlidePreview,
  FORMAT_LABELS,
  FORMAT_DIMENSIONS,
} from "@/components/carousel/slide-preview";
import { saveCarouselAction } from "@/actions/carousels";
import { makeDefaultSlide } from "@/types/carousel";
import type {
  Carousel,
  CarouselFormat,
  CarouselSlide,
  PostStyle,
} from "@/types/carousel";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#000000", "#0a0a0a", "#111111", "#1a1a2e", "#0d1117", "#1c1c1e",
  "#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1",
  "#e2e8f0", "#f1f5f9", "#f8fafc", "#ffffff", "#fef9c3", "#fef3c7",
  "#3b82f6", "#2563eb", "#8b5cf6", "#7c3aed", "#ec4899", "#db2777",
  "#10b981", "#059669", "#f59e0b", "#d97706", "#ef4444", "#dc2626",
  "#06b6d4", "#0891b2", "#84cc16", "#65a30d", "#f97316", "#ea580c",
];

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

function SidebarSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/6 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {title}
        <span className={cn("text-muted-foreground/40 transition-transform duration-200", open && "rotate-90")}>
          ›
        </span>
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[0.625rem] text-muted-foreground/70">{label}</label>
        <span className="text-[0.625rem] font-mono text-muted-foreground">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer accent-primary"
      />
    </div>
  );
}

// Modern color picker with presets + hex input
function ModernColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const nativeRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHex(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function commitHex(raw: string) {
    const v = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-f]{6}$/i.test(v)) { onChange(v); setHex(v); }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="size-9 shrink-0 rounded-lg border-2 border-border shadow-sm transition-transform hover:scale-110"
          style={{ backgroundColor: value }}
          title={label}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[0.625rem] text-muted-foreground/70 mb-1">{label}</p>
          <Input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onBlur={(e) => commitHex(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitHex(hex)}
            className="h-7 font-mono text-xs uppercase"
            maxLength={7}
          />
        </div>
      </div>

      {open && (
        <div className="absolute left-0 top-12 z-30 w-64 rounded-xl border border-border bg-card p-3 shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
          {/* Preset grid */}
          <div className="grid grid-cols-9 gap-1 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setHex(c); setOpen(false); }}
                className={cn(
                  "size-6 rounded-md border transition-transform hover:scale-110",
                  value === c ? "border-primary ring-1 ring-primary" : "border-white/10"
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          {/* Hex + native picker */}
          <div className="flex items-center gap-2">
            <Input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              onBlur={(e) => commitHex(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { commitHex(hex); setOpen(false); } }}
              placeholder="#000000"
              className="h-7 flex-1 font-mono text-xs uppercase"
              maxLength={7}
            />
            <button
              onClick={() => nativeRef.current?.click()}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[0.625rem] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Pipette className="size-3" />
              Custom
            </button>
            <input
              ref={nativeRef}
              type="color"
              value={value}
              onChange={(e) => { onChange(e.target.value); setHex(e.target.value); }}
              className="sr-only"
            />
          </div>
        </div>
      )}
    </div>
  );
}

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
        "border-border text-xs text-muted-foreground transition-colors",
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
          <p className="text-[0.625rem] text-muted-foreground/60 uppercase tracking-widest">
            Cores extraídas — clique para aplicar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((c) => (
              <div key={c} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => onApply(c, c, c)}
                  title={`Aplicar ${c}`}
                  className="size-8 rounded-lg border-2 border-white/10 shadow-sm transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                />
                <span className="text-[0.5rem] font-mono text-muted-foreground/50">{c}</span>
              </div>
            ))}
          </div>
          <p className="text-[0.5625rem] text-muted-foreground/50 leading-relaxed">
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
  imagem: false,
};

const STRIP_WIDTHS: Record<CarouselFormat, number> = {
  carousel: 270,
  square: 275,
  stories: 190,
};

export function CarouselEditor({ initial }: { initial: Carousel }) {
  const [carousel, setCarousel] = useState<Carousel>({
    ...initial,
    post_style: initial.post_style ?? "minimal",
  });
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

  const currentSlide = carousel.slides[currentIdx] ?? carousel.slides[0];
  const slideWidth = STRIP_WIDTHS[carousel.format];

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
    if (!slideRef.current) return;
    const dims = FORMAT_DIMENSIONS[carousel.format];
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(slideRef.current, { width: dims.width, height: dims.height, pixelRatio: 1 });
      const link = document.createElement("a");
      link.download = `slide-${currentIdx + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Instale html-to-image: npm install html-to-image");
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">

      {/* ── Header bar ── */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-sidebar px-4 dark:border-white/7 dark:bg-sidebar">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/carousel" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="size-3.5" />
            Carrosséis
          </Link>
          <span className="text-muted-foreground/30 shrink-0">|</span>
          <input
            value={carousel.name}
            onChange={(e) => updateCarousel({ name: e.target.value })}
            className="min-w-0 max-w-[200px] bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/40"
            placeholder="Nome do carrossel"
          />
        </div>

        {/* Center: slide nav */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <button onClick={() => selectSlide(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0} className="rounded p-1 hover:bg-muted/60 disabled:opacity-30 transition-colors">
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs font-medium text-foreground/80">
            Slide {currentIdx + 1} / {carousel.slides.length}
          </span>
          <button onClick={() => selectSlide(Math.min(carousel.slides.length - 1, currentIdx + 1))} disabled={currentIdx === carousel.slides.length - 1} className="rounded p-1 hover:bg-muted/60 disabled:opacity-30 transition-colors">
            <ChevronRight className="size-3.5" />
          </button>
          <button onClick={addSlide} className="ml-1 rounded p-1 hover:bg-muted/60 transition-colors" title="Adicionar slide">
            <Plus className="size-3.5" />
          </button>
          <button onClick={removeSlide} className="rounded p-1 hover:bg-negative/15 text-muted-foreground hover:text-negative transition-colors" title="Remover slide">
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={handleCaption} disabled={captionLoading}>
            {captionLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Legenda
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={handleExport}>
            <Download className="size-3.5" />
            Baixar
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </Button>
        </div>
      </header>

      {/* ── Body: sidebar + canvas ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <aside className="w-72 shrink-0 flex flex-col overflow-y-auto border-r border-border/50 bg-sidebar dark:border-white/7 dark:bg-sidebar">

          {/* Format selector */}
          <div className="px-5 py-3.5 border-b border-white/6">
            <label className="block text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 mb-2">Formato</label>
            <div className="flex gap-1">
              {(["carousel", "square", "stories"] as CarouselFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => updateCarousel({ format: f })}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-[0.625rem] font-medium transition-colors",
                    carousel.format === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {FORMAT_LABELS[f].split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Estilo do Post */}
          <SidebarSection title="Estilo do Post" open={!!sections.estilo} onToggle={() => toggleSection("estilo")}>
            <div className="grid grid-cols-1 gap-1.5">
              {POST_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => updateCarousel({ post_style: style.id })}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-premium",
                    carousel.post_style === style.id
                      ? "border-primary/40 bg-primary/8 text-foreground"
                      : "border-border/40 hover:border-border/70 hover:bg-muted/30 text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "size-5 shrink-0 rounded-md border-2",
                    carousel.post_style === style.id ? "border-primary bg-primary/20" : "border-muted-foreground/20 bg-muted/30"
                  )} />
                  <div className="min-w-0">
                    <p className={cn("text-xs font-semibold", carousel.post_style === style.id ? "text-foreground" : "text-foreground/70")}>
                      {style.label}
                    </p>
                    <p className="text-[0.6rem] text-muted-foreground/60 truncate">{style.desc}</p>
                  </div>
                  {carousel.post_style === style.id && (
                    <span className="ml-auto text-[0.5rem] font-bold text-primary uppercase tracking-wider">Ativo</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[0.5625rem] text-muted-foreground/40 leading-relaxed">
              Os layouts de cada estilo serão construídos em breve.
            </p>
          </SidebarSection>

          {/* Gerar com IA */}
          <SidebarSection title="Gerar com IA" open={!!sections.ai} onToggle={() => toggleSection("ai")}>
            <div className="space-y-2">
              <p className="text-[0.625rem] text-muted-foreground/60 font-medium uppercase tracking-widest">Do zero</p>
              <Textarea
                placeholder="Ex: Como dobrar suas vendas no Instagram em 30 dias"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="text-xs resize-none"
                rows={3}
              />
              <RangeControl label="Quantidade de slides" value={slideCount} min={1} max={20} unit="" onChange={setSlideCount} />
              <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleGenerate} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {aiGenerating ? "Gerando..." : `Gerar ${slideCount} slides`}
              </Button>
            </div>
            <div className="space-y-2 pt-2 border-t border-white/6">
              <p className="text-[0.625rem] text-muted-foreground/60 font-medium uppercase tracking-widest">Melhorar atual</p>
              <Textarea
                placeholder='Ex: "Deixe os títulos mais curtos e diretos"'
                value={improveInstruction}
                onChange={(e) => setImproveInstruction(e.target.value)}
                className="text-xs resize-none"
                rows={2}
              />
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={handleImprove} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Melhorar conteúdo
              </Button>
            </div>
          </SidebarSection>

          {/* Texto */}
          <SidebarSection title={`Texto — Slide ${currentIdx + 1}`} open={!!sections.texto} onToggle={() => toggleSection("texto")}>
            <div className="space-y-1.5">
              <label className="text-[0.625rem] text-muted-foreground/70">Título</label>
              <Textarea
                value={currentSlide?.titulo ?? ""}
                onChange={(e) => updateSlide({ titulo: e.target.value })}
                placeholder="Título do slide"
                className="text-xs resize-none"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[0.625rem] text-muted-foreground/70">Subtítulo</label>
              <Textarea
                value={currentSlide?.subtitulo ?? ""}
                onChange={(e) => updateSlide({ subtitulo: e.target.value })}
                placeholder="Subtítulo ou frase de apoio"
                className="text-xs resize-none"
                rows={2}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-white/6">
              <p className="text-[0.625rem] text-muted-foreground/60 font-medium uppercase tracking-widest">Refinar com IA</p>
              <Textarea
                placeholder='Ex: "Torne mais direto e adicione dado estatístico"'
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                className="text-xs resize-none"
                rows={2}
              />
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={handleRefine} disabled={refining}>
                {refining ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Refinar este slide
              </Button>
            </div>
          </SidebarSection>

          {/* Cores */}
          <SidebarSection title="Cores" open={!!sections.cores} onToggle={() => toggleSection("cores")}>
            {/* Tab */}
            <div className="flex gap-1 rounded-lg border border-border/40 bg-muted/20 p-0.5 mb-1">
              {(["manual", "imagem"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setColorTab(tab)}
                  className={cn(
                    "flex-1 rounded-md py-1 text-[0.625rem] font-medium transition-colors",
                    colorTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "manual" ? "Manual" : "Via Imagem"}
                </button>
              ))}
            </div>

            {colorTab === "manual" ? (
              <>
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
                  className="w-full text-xs"
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
          <SidebarSection title="Tipografia" open={!!sections.tipografia} onToggle={() => toggleSection("tipografia")}>
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

          {/* Imagem de fundo */}
          <SidebarSection title={`Imagem de Fundo — Slide ${currentIdx + 1}`} open={!!sections.imagem} onToggle={() => toggleSection("imagem")}>
            <label className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-xs transition-colors",
              currentSlide?.imagemFundo
                ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/8"
                : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
            )}>
              <input type="file" accept="image/*" className="sr-only" onChange={handleBgImageUpload} />
              <ImagePlus className="size-3.5" />
              {currentSlide?.imagemFundo ? "Trocar imagem" : "Carregar imagem (máx 25 MB)"}
            </label>

            {currentSlide?.imagemFundo && (
              <>
                {/* Preview strip */}
                <div className="relative w-full overflow-hidden rounded-lg" style={{ height: 70 }}>
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
                  label="Overlay escuro"
                  value={currentSlide.overlayOpacidade ?? 0}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateSlide({ overlayOpacidade: v })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-negative hover:bg-negative/10"
                  onClick={() => updateSlide({ imagemFundo: null, overlayOpacidade: 0, imagemPosX: 50, imagemPosY: 50, imagemZoom: 150 })}
                >
                  Remover imagem
                </Button>
              </>
            )}
          </SidebarSection>
        </aside>

        {/* ── Canvas: horizontal slide strip ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Horizontal strip */}
          <div
            ref={stripRef}
            className="flex flex-1 items-start gap-5 overflow-x-auto overflow-y-auto px-6 pt-7 pb-8"
            style={{ scrollbarWidth: "thin" }}
          >
            {carousel.slides.map((slide, i) => {
              const isActive = i === currentIdx;
              return (
                <div
                  key={slide.id}
                  className="shrink-0 flex flex-col gap-2"
                  style={{ width: slideWidth }}
                >
                  <button
                    onClick={() => selectSlide(i)}
                    className={cn(
                      "relative overflow-hidden rounded-2xl transition-all duration-200 focus:outline-none",
                      isActive
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-2xl shadow-primary/20 scale-[1.02]"
                        : "ring-1 ring-white/8 opacity-70 hover:opacity-100 hover:ring-white/20 hover:scale-[1.01]"
                    )}
                  >
                    <SlidePreview
                      slide={slide}
                      format={carousel.format}
                      previewWidth={slideWidth}
                      innerRef={isActive ? slideRef : undefined}
                    />
                  </button>
                  {/* Slide number + label */}
                  <div className="flex items-center justify-between px-0.5">
                    <span className={cn("text-[0.625rem] font-medium", isActive ? "text-primary" : "text-muted-foreground/50")}>
                      Slide {i + 1}
                    </span>
                    {isActive && (
                      <span className="text-[0.5rem] text-primary/70 font-semibold uppercase tracking-wider">
                        Editando
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add slide */}
            <button
              onClick={addSlide}
              className={cn(
                "shrink-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/40 transition-colors hover:border-primary/40 hover:bg-primary/5",
                "text-muted-foreground hover:text-primary"
              )}
              style={{
                width: slideWidth * 0.55,
                height: (slideWidth * 0.55 * FORMAT_DIMENSIONS[carousel.format].height) / FORMAT_DIMENSIONS[carousel.format].width,
                marginTop: 0,
              }}
            >
              <Plus className="size-5" />
              <span className="text-[0.625rem] font-medium">Novo slide</span>
            </button>
          </div>

          {/* Footer info bar */}
          <div className="flex h-8 shrink-0 items-center justify-between border-t border-border/30 px-6 dark:border-white/5">
            <span className="text-[0.625rem] text-muted-foreground/50">
              {FORMAT_LABELS[carousel.format]} · {FORMAT_DIMENSIONS[carousel.format].width}×{FORMAT_DIMENSIONS[carousel.format].height}px
            </span>
            <span className="text-[0.625rem] text-muted-foreground/50">
              {carousel.slides.length} slide{carousel.slides.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Caption modal ── */}
      {caption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCaption(null)} />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">Legenda gerada</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Legenda e hashtags para o Instagram</p>
              </div>
              <button onClick={() => setCaption(null)} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
            </div>
            <div className="px-6 pb-6 space-y-4">
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={10} className="text-sm font-mono" />
              <div className="flex justify-between gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(caption); toast.success("Copiado!"); }}>
                  <Copy className="size-3.5" />
                  Copiar
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCaption} disabled={captionLoading}>
                    {captionLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    Regerar
                  </Button>
                  <Button size="sm" onClick={() => setCaption(null)}>Fechar</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
