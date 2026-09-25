"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  Expand,
  History,
  ImageIcon,
  Loader2,
  Palette,
  PenLine,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/layout/section-header";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import {
  loadGeradorImagesAction,
  saveGeradorImageAction,
  deleteGeradorImageAction,
  type GeradorImage,
} from "@/actions/gerador";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASPECT_RATIOS = [
  { value: "4:5", label: "4:5", hint: "Feed" },
  { value: "9:16", label: "9:16", hint: "Stories" },
  { value: "1:1", label: "1:1", hint: "Square" },
  { value: "3:4", label: "3:4", hint: "Retrato" },
  { value: "16:9", label: "16:9", hint: "Wide" },
] as const;

const SHOT_TYPES = [
  {
    value: "close",
    label: "Close up",
    prompt:
      "extreme close-up shot, face and upper shoulders filling the frame, shallow depth of field, intimate portrait",
  },
  {
    value: "medium",
    label: "Plano médio",
    prompt: "medium shot, waist up, balanced framing, natural depth of field",
  },
  {
    value: "american",
    label: "Plano americano",
    prompt: "cowboy shot, from knee to head, three-quarter view, cinematic composition",
  },
  {
    value: "full",
    label: "Corpo inteiro",
    prompt: "full body shot, head to toe, fashion photography style, environmental context",
  },
] as const;

const LIGHTING_OPTIONS = [
  {
    value: "natural",
    label: "Natural",
    prompt: "natural window lighting, soft diffused daylight, bright and airy, realistic shadows",
  },
  {
    value: "studio",
    label: "Estúdio",
    prompt: "professional studio lighting, controlled illumination, soft boxes, even exposure",
  },
  {
    value: "golden",
    label: "Golden Hour",
    prompt: "golden hour lighting, warm amber sunlight, long soft shadows, cinematic warmth",
  },
  {
    value: "dramatic",
    label: "Dramática",
    prompt: "dramatic chiaroscuro lighting, high contrast, bold shadows, noir atmosphere",
  },
  {
    value: "neon",
    label: "Neon",
    prompt: "neon colored lighting, vibrant RGB glows, urban night atmosphere, glowing highlights",
  },
  {
    value: "soft",
    label: "Suave",
    prompt: "soft diffused lighting, gentle illumination, minimal shadows, beauty light",
  },
] as const;

const COLOR_MOODS = [
  { value: "warm", label: "Quente", swatch: "#E88040", prompt: "warm color grading, golden amber tones, cozy atmosphere" },
  { value: "cool", label: "Frio", swatch: "#4080E8", prompt: "cool color grading, blue and teal tones, clean professional look" },
  { value: "vibrant", label: "Vibrante", swatch: "#C840E8", prompt: "highly saturated vibrant colors, energetic bold visual style" },
  { value: "muted", label: "Suave", swatch: "#A09080", prompt: "muted desaturated palette, earth tones, sophisticated aesthetic" },
  { value: "dark", label: "Dark", swatch: "#1A1A2E", prompt: "dark moody color grading, deep shadows, rich dark tones, luxury premium feel" },
  { value: "pastel", label: "Pastel", swatch: "#F0C8E0", prompt: "soft pastel color palette, light airy tones, dreamy gentle atmosphere" },
] as const;

const IMAGE_COUNTS = [1, 2, 3, 4] as const;
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 80;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AspectRatioValue = (typeof ASPECT_RATIOS)[number]["value"];
type TaskStatus = "CREATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

type TaskCard = {
  localId: string;
  taskId: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  imageUrl: string | null;
  error: string | null;
};

type GeneratedResult = {
  id: string | null; // null until saved to DB
  url: string;
  aspectRatio: string;
  resolution: string;
  prompt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAspectClass(ratio: string): string {
  const map: Record<string, string> = {
    "4:5": "aspect-[4/5]",
    "9:16": "aspect-[9/16]",
    "1:1": "aspect-square",
    "3:4": "aspect-[3/4]",
    "16:9": "aspect-video",
  };
  return map[ratio] ?? "aspect-square";
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compileFullPrompt(params: {
  prompt: string;
  referenceDna: string | null;
  characterGender: "male" | "female" | null;
  shotType: string;
  lighting: string;
  colorMood: string;
}): string {
  const parts: string[] = [params.prompt.trim()];

  if (params.referenceDna) {
    parts.push(`Reference style: ${params.referenceDna}`);
  }

  const shot = SHOT_TYPES.find((s) => s.value === params.shotType);
  if (shot) parts.push(shot.prompt);

  const light = LIGHTING_OPTIONS.find((l) => l.value === params.lighting);
  if (light) parts.push(light.prompt);

  const color = COLOR_MOODS.find((c) => c.value === params.colorMood);
  if (color) parts.push(color.prompt);

  if (params.characterGender) {
    const g = params.characterGender === "male" ? "male, man" : "female, woman";
    parts.push(`The main character is ${g}`);
  }

  return parts.join(". ");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AspectRatioIcon({ ratio }: { ratio: string }) {
  const [wStr, hStr] = ratio.split(":");
  const w = Number(wStr);
  const h = Number(hStr);
  const max = 16;
  const dw = w >= h ? max : Math.round((w / h) * max);
  const dh = h >= w ? max : Math.round((h / w) * max);
  const ox = (max - dw) / 2;
  const oy = (max - dh) / 2;
  return (
    <svg width={max} height={max} viewBox={`0 0 ${max} ${max}`} className="shrink-0">
      <rect x={ox} y={oy} width={dw} height={dh} rx={1.5} fill="currentColor" opacity={0.75} />
    </svg>
  );
}

const chipBase =
  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-premium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45";
const chipActive = "border-primary/50 bg-primary/12 text-primary";
const chipIdle =
  "border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-accent hover:text-foreground";

function OptionChip({
  active,
  onClick,
  children,
  className,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(chipBase, active ? chipActive : chipIdle, className)}
    >
      {children}
    </button>
  );
}

/** Rótulo de campo — sentence case, com dica opcional à direita. */
function FieldLabel({
  children,
  hint,
  htmlFor,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[0.8125rem] font-semibold text-foreground">
        {children}
      </label>
      {hint && <span className="text-[0.6875rem] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Bloco do painel de controles (seção com título e divisória). */
function ControlGroup({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-b border-border p-5 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            tones[tone].iconTile
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ImageDropArea({
  label,
  sublabel,
  preview,
  onFile,
  onRemove,
  disabled,
}: {
  label: string;
  sublabel?: string;
  preview: string | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt={label} className="max-h-40 w-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover imagem"
          className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg border border-border bg-popover/90 text-foreground shadow-[var(--surface-shadow)] transition-colors hover:bg-accent"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-3.5 py-3 text-left transition-premium outline-none",
          "hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/50",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/12 group-hover:text-primary">
          <Upload className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.8125rem] font-semibold text-foreground">{label}</span>
          {sublabel && (
            <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{sublabel}</span>
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}

function GeneratingCard({ aspectRatio }: { aspectRatio: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--surface-shadow)]",
        getAspectClass(aspectRatio)
      )}
      style={{ maxHeight: aspectRatio === "9:16" ? 400 : undefined }}
    >
      {/* Leve pulso do tom de geração (IA) */}
      <div
        className="absolute inset-0 animate-pulse bg-gradient-to-tr from-primary/8 via-transparent to-tone-pink/8"
        style={{ animationDuration: "3s" }}
      />

      {/* Shimmer sweep */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
          style={{
            animation: "shimmer-sweep 2.2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="relative size-12">
          <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
            style={{ animation: "spin 1.4s linear infinite" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="size-4 animate-pulse text-primary" />
          </div>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">Gerando…</p>
      </div>
    </div>
  );
}

const overlayButton =
  "flex size-8 items-center justify-center rounded-lg border border-border bg-popover/90 text-foreground shadow-[var(--surface-shadow)] transition-colors hover:bg-accent";

function ResultCard({
  result,
  onFullscreen,
  onDelete,
}: {
  result: GeneratedResult;
  onFullscreen: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDownload() {
    const res = await fetch(result.url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gerador-${Date.now()}.jpg`;
    a.click();
  }

  async function handleDelete() {
    if (!result.id) return;
    setDeleting(true);
    const res = await deleteGeradorImageAction(result.id);
    if ("error" in res) {
      toast.error(res.error);
      setDeleting(false);
    } else {
      onDelete();
    }
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--surface-shadow)] transition-premium hover:border-border-strong hover:shadow-[var(--surface-shadow-hover)]",
        getAspectClass(result.aspectRatio),
        deleting && "pointer-events-none opacity-50"
      )}
      style={{ maxHeight: result.aspectRatio === "9:16" ? 400 : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={result.url} alt="Imagem gerada" className="h-full w-full object-cover" />

      {/* Overlay (scrim para legibilidade sobre a foto) */}
      <div className="absolute inset-0 flex flex-col items-end justify-start gap-1.5 bg-gradient-to-b from-background/60 to-transparent p-2.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <div className="flex gap-1.5">
          <button onClick={onFullscreen} aria-label="Ver em tela cheia" className={overlayButton}>
            <Expand className="size-3.5" />
          </button>
          <button onClick={handleDownload} aria-label="Baixar imagem" className={overlayButton}>
            <Download className="size-3.5" />
          </button>
          {result.id && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Excluir imagem"
              className="flex size-8 items-center justify-center rounded-lg border border-tone-red/25 bg-popover/90 text-tone-red shadow-[var(--surface-shadow)] transition-colors hover:bg-tone-red/15"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FullscreenViewer({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDownload() {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gerador-${Date.now()}.jpg`;
    a.click();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagem em tela cheia"
      className="animate-in-soft fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 p-4 backdrop-blur-xl"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex max-h-[95vh] max-w-[95vw] flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Imagem em tela cheia"
          className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-[var(--surface-shadow-elevated)] ring-1 ring-border"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download />
            Baixar
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X />
            Fechar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImageGenerator() {
  // Prompt
  const [prompt, setPrompt] = useState("");

  // Character
  const [characterFile, setCharacterFile] = useState<File | null>(null);
  const [characterPreview, setCharacterPreview] = useState<string | null>(null);
  const [characterGender, setCharacterGender] = useState<"male" | "female" | null>(null);

  // Reference
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [referenceUploadedUrl, setReferenceUploadedUrl] = useState<string | null>(null);
  const [referenceDna, setReferenceDna] = useState<string>("");
  const [isDnaExtracting, setIsDnaExtracting] = useState(false);

  // Generation options
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>("4:5");
  const [resolution, setResolution] = useState("2K");
  const [shotType, setShotType] = useState("medium");
  const [lighting, setLighting] = useState("natural");
  const [colorMood, setColorMood] = useState("warm");
  const [imageCount, setImageCount] = useState<number>(1);

  // Tasks & results
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load saved images on mount
  useEffect(() => {
    loadGeradorImagesAction().then((images: GeradorImage[]) => {
      setResults(
        images.map((img) => ({
          id: img.id,
          url: img.url,
          aspectRatio: img.aspect_ratio,
          resolution: img.resolution,
          prompt: img.prompt,
        }))
      );
      setLoadingHistory(false);
    }).catch(() => setLoadingHistory(false));
  }, []);

  const isGenerating = tasks.some((t) => t.status === "pending" || t.status === "in_progress");

  function updateTask(localId: string, patch: Partial<TaskCard>) {
    setTasks((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));
  }

  const pollTask = useCallback(
    async (localId: string, taskId: string, attempt = 0) => {
      if (attempt >= MAX_POLLS) {
        updateTask(localId, { status: "failed", error: "Tempo limite excedido" });
        return;
      }
      try {
        const res = await fetch(`/api/gerador/task/${taskId}`);
        const data = await res.json() as {
          taskId: string;
          status: TaskStatus;
          generated: string[];
          error?: string;
        };

        if (!res.ok) {
          updateTask(localId, { status: "failed", error: data.error ?? "Erro ao verificar" });
          return;
        }

        if (data.status === "COMPLETED" && data.generated[0]) {
          const imageUrl = data.generated[0];
          updateTask(localId, { status: "completed", imageUrl });

          // Save to DB and prepend with id
          const newResult: GeneratedResult = {
            id: null,
            url: imageUrl,
            aspectRatio,
            resolution,
            prompt,
          };
          setResults((prev) => [newResult, ...prev]);

          // O save baixa a imagem pro Storage e devolve a URL permanente —
          // troca a URL temporária da Magnific na tela também.
          saveGeradorImageAction(imageUrl, aspectRatio, resolution, prompt).then((res) => {
            if ("id" in res) {
              setResults((prev) =>
                prev.map((r) =>
                  r.url === imageUrl && r.id === null ? { ...r, id: res.id, url: res.url } : r
                )
              );
              updateTask(localId, { imageUrl: res.url });
            }
          });
          return;
        }

        if (data.status === "FAILED") {
          updateTask(localId, { status: "failed", error: "Geração falhou" });
          return;
        }

        const timer = setTimeout(() => pollTask(localId, taskId, attempt + 1), POLL_INTERVAL_MS);
        pollTimers.current.set(localId, timer);
      } catch {
        updateTask(localId, { status: "failed", error: "Erro de rede" });
      }
    },
    [aspectRatio]
  );

  // Cleanup on unmount
  useEffect(() => {
    const timers = pollTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // Reference file selection → auto extract DNA + upload
  async function handleReferenceFile(file: File) {
    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
    setReferenceDna("");
    setReferenceUploadedUrl(null);
    setIsDnaExtracting(true);

    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type;

      const [uploadRes, dnaRes] = await Promise.all([
        fetch("/api/gerador/upload-ref", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType }),
        }),
        fetch("/api/gerador/extract-dna", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType }),
        }),
      ]);

      const [uploadData, dnaData] = await Promise.all([uploadRes.json(), dnaRes.json()]);

      if (uploadData.url) setReferenceUploadedUrl(uploadData.url);
      if (dnaData.dna) setReferenceDna(dnaData.dna);
    } catch {
      // not fatal — user can still generate without DNA
    } finally {
      setIsDnaExtracting(false);
    }
  }

  function handleRemoveReference() {
    setReferenceFile(null);
    setReferencePreview(null);
    setReferenceUploadedUrl(null);
    setReferenceDna("");
  }

  function handleCharacterFile(file: File) {
    setCharacterFile(file);
    setCharacterPreview(URL.createObjectURL(file));
  }

  function handleRemoveCharacter() {
    setCharacterFile(null);
    setCharacterPreview(null);
    setCharacterGender(null);
  }

  async function handleGenerate() {
    if (!prompt.trim() || isGenerating) return;
    setGlobalError(null);

    // Build initial task cards
    const newTasks: TaskCard[] = Array.from({ length: imageCount }, (_, i) => ({
      localId: `${Date.now()}-${i}`,
      taskId: null,
      status: "pending",
      imageUrl: null,
      error: null,
    }));
    setTasks(newTasks);

    // Upload character if needed
    let characterUrl: string | null = null;
    if (characterFile) {
      try {
        const base64 = await fileToBase64(characterFile);
        const res = await fetch("/api/gerador/upload-ref", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType: characterFile.type }),
        });
        const data = await res.json();
        characterUrl = data.url ?? null;
      } catch {
        // non-fatal
      }
    }

    // Build reference_images array
    const referenceImages: { image: string; mime_type: string; text: string }[] = [];
    if (characterUrl && characterFile) {
      const genderHint = characterGender
        ? ` — ${characterGender === "male" ? "male, man" : "female, woman"}`
        : "";
      referenceImages.push({
        image: characterUrl,
        mime_type: characterFile.type,
        text: `Main character avatar${genderHint} — keep their physical appearance faithfully`,
      });
    }
    if (referenceUploadedUrl && referenceFile) {
      referenceImages.push({
        image: referenceUploadedUrl,
        mime_type: referenceFile.type,
        text: "Use this as the style, composition and layout reference",
      });
    }

    // Compile full prompt
    const fullPrompt = compileFullPrompt({
      prompt,
      referenceDna: referenceDna.trim() || null,
      characterGender,
      shotType,
      lighting,
      colorMood,
    });

    // Fire N generate requests
    await Promise.all(
      newTasks.map(async (task) => {
        try {
          const res = await fetch("/api/gerador/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: fullPrompt,
              aspect_ratio: aspectRatio,
              resolution,
              reference_images: referenceImages.length ? referenceImages : undefined,
            }),
          });

          const data = await res.json() as { taskId?: string; error?: string };

          if (!res.ok || !data.taskId) {
            updateTask(task.localId, { status: "failed", error: data.error ?? "Erro ao iniciar" });
            return;
          }

          updateTask(task.localId, { taskId: data.taskId, status: "in_progress" });
          void pollTask(task.localId, data.taskId);
        } catch {
          updateTask(task.localId, { status: "failed", error: "Erro de rede" });
        }
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
      {/* ── LEFT: Controls panel ── */}
      <div className="surface-panel overflow-hidden">
        {/* Prompt */}
        <ControlGroup title="Descreva a imagem" icon={PenLine} tone="violet">
          <div className="space-y-1.5">
            <Textarea
              id="gerador-prompt"
              aria-label="Prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva a cena, ambiente, personagem e estilo que deseja gerar..."
              rows={5}
              maxLength={3000}
              disabled={isGenerating}
              className="min-h-[120px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
            />
            <p className="text-right text-[0.6875rem] tabular-nums text-muted-foreground">
              {prompt.length}/3000
            </p>
          </div>
        </ControlGroup>

        {/* References */}
        <ControlGroup title="Referências" icon={ImageIcon} tone="cyan">
          <div className="space-y-2">
            <FieldLabel hint="Opcional">Personagem</FieldLabel>
            <ImageDropArea
              label="Enviar foto do personagem"
              sublabel="PNG, JPG ou WebP"
              preview={characterPreview}
              onFile={handleCharacterFile}
              onRemove={handleRemoveCharacter}
              disabled={isGenerating}
            />
            {characterPreview && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">Sexo</span>
                {(["male", "female"] as const).map((g) => (
                  <OptionChip
                    key={g}
                    active={characterGender === g}
                    onClick={() => setCharacterGender((prev) => (prev === g ? null : g))}
                  >
                    {g === "male" ? "Masculino" : "Feminino"}
                  </OptionChip>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <FieldLabel hint="Opcional">Referência visual</FieldLabel>
            <ImageDropArea
              label="Enviar imagem de referência"
              sublabel="A IA extrai a composição, cores e estilo"
              preview={referencePreview}
              onFile={handleReferenceFile}
              onRemove={handleRemoveReference}
              disabled={isGenerating}
            />

            {referencePreview && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">DNA extraído</span>
                  {isDnaExtracting && <Loader2 className="size-3 animate-spin text-primary" />}
                </div>
                {isDnaExtracting ? (
                  <div className="animate-pulse rounded-xl border border-dashed border-border-strong bg-surface px-3 py-2 text-xs text-muted-foreground">
                    Analisando composição e estilo...
                  </div>
                ) : (
                  <Textarea
                    value={referenceDna}
                    onChange={(e) => setReferenceDna(e.target.value)}
                    rows={3}
                    placeholder="DNA visual (editável)"
                    aria-label="DNA visual"
                    className="min-h-0 resize-none px-3 py-2 text-xs"
                  />
                )}
              </div>
            )}
          </div>
        </ControlGroup>

        {/* Style */}
        <ControlGroup title="Estilo" icon={Palette} tone="pink">
          <div className="space-y-2">
            <FieldLabel>Plano</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {SHOT_TYPES.map((s) => (
                <OptionChip key={s.value} active={shotType === s.value} onClick={() => setShotType(s.value)}>
                  {s.label}
                </OptionChip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>Iluminação</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {LIGHTING_OPTIONS.map((l) => (
                <OptionChip key={l.value} active={lighting === l.value} onClick={() => setLighting(l.value)}>
                  {l.label}
                </OptionChip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>Cor e mood</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_MOODS.map((c) => (
                <OptionChip
                  key={c.value}
                  active={colorMood === c.value}
                  onClick={() => setColorMood(c.value)}
                >
                  {/* Swatch = prévia do mood (valor de conteúdo, não cor de interface) */}
                  <span
                    className="size-2.5 shrink-0 rounded-full ring-1 ring-border-strong"
                    style={{ backgroundColor: c.swatch }}
                  />
                  {c.label}
                </OptionChip>
              ))}
            </div>
          </div>
        </ControlGroup>

        {/* Output */}
        <ControlGroup title="Saída" icon={SlidersHorizontal} tone="slate">
          <div className="space-y-2">
            <FieldLabel>Formato</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_RATIOS.map((ar) => (
                <OptionChip
                  key={ar.value}
                  disabled={isGenerating}
                  active={aspectRatio === ar.value}
                  onClick={() => setAspectRatio(ar.value)}
                >
                  <AspectRatioIcon ratio={ar.value} />
                  <span>{ar.label}</span>
                  <span className="font-medium opacity-60">{ar.hint}</span>
                </OptionChip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-5">
            <div className="space-y-2">
              <FieldLabel>Resolução</FieldLabel>
              <div className="flex gap-1.5">
                {(["1K", "2K", "4K"] as const).map((r) => (
                  <OptionChip key={r} active={resolution === r} onClick={() => setResolution(r)}>
                    {r}
                  </OptionChip>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Quantidade</FieldLabel>
              <div className="flex gap-1.5">
                {IMAGE_COUNTS.map((n) => (
                  <OptionChip
                    key={n}
                    active={imageCount === n}
                    onClick={() => setImageCount(n)}
                    className="min-w-8 justify-center tabular-nums"
                  >
                    {n}
                  </OptionChip>
                ))}
              </div>
            </div>
          </div>
        </ControlGroup>

        {/* Generate */}
        <div className="space-y-2.5 border-t border-border bg-surface/60 p-5">
          {globalError && (
            <p className="rounded-xl border border-tone-red/25 bg-tone-red/12 px-3 py-2 text-sm text-tone-red">
              {globalError}
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating || isDnaExtracting}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {isGenerating
              ? "Gerando..."
              : `Gerar ${imageCount > 1 ? `${imageCount} imagens` : "imagem"}`}
          </Button>
          <p className="text-center text-[0.6875rem] text-muted-foreground">
            <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[0.625rem] font-semibold text-foreground">
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[0.625rem] font-semibold text-foreground">
              Enter
            </kbd>{" "}
            para gerar
          </p>
        </div>
      </div>

      {/* ── RIGHT: Result canvas ── */}
      <div className="relative min-h-[32rem] overflow-hidden rounded-2xl border border-border bg-surface">
        <div
          aria-hidden
          className="bg-dot-grid pointer-events-none absolute inset-0 opacity-70"
        />

        <div className="relative space-y-8 p-4 sm:p-6">
          {tasks.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                icon={Sparkles}
                tone="pink"
                title="Geração atual"
                description={
                  isGenerating
                    ? `Gerando ${tasks.length} ${tasks.length > 1 ? "imagens" : "imagem"}…`
                    : `${tasks.length} ${tasks.length > 1 ? "imagens" : "imagem"} · ${aspectRatio}`
                }
              />
              <div
                className={cn(
                  "grid gap-4",
                  tasks.length === 1 ? "max-w-sm grid-cols-1" : "grid-cols-2"
                )}
              >
                {tasks.map((task) => {
                  if (task.status === "completed" && task.imageUrl) {
                    const matchedResult = results.find((r) => r.url === task.imageUrl);
                    return (
                      <ResultCard
                        key={task.localId}
                        result={matchedResult ?? { id: null, url: task.imageUrl, aspectRatio, resolution, prompt }}
                        onFullscreen={() => setFullscreenUrl(task.imageUrl)}
                        onDelete={() => setResults((prev) => prev.filter((r) => r.url !== task.imageUrl))}
                      />
                    );
                  }
                  if (task.status === "failed") {
                    return (
                      <div
                        key={task.localId}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 rounded-2xl border border-tone-red/25 bg-tone-red/8 p-4 text-center text-xs font-medium text-tone-red",
                          getAspectClass(aspectRatio)
                        )}
                        style={{ maxHeight: aspectRatio === "9:16" ? 400 : undefined }}
                      >
                        <AlertTriangle className="size-4" />
                        {task.error ?? "Falhou"}
                      </div>
                    );
                  }
                  return <GeneratingCard key={task.localId} aspectRatio={aspectRatio} />;
                })}
              </div>
            </section>
          )}

          {/* History */}
          {(results.length > 0 || loadingHistory) && (
            <section className="space-y-4">
              <SectionHeader
                icon={History}
                tone="violet"
                title="Histórico"
                description={
                  loadingHistory
                    ? "Carregando histórico..."
                    : `${results.length} imagem${results.length !== 1 ? "ns" : ""} salva${results.length !== 1 ? "s" : ""}`
                }
              />
              {loadingHistory ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
                  {results.map((r) => (
                    <ResultCard
                      key={r.url}
                      result={r}
                      onFullscreen={() => setFullscreenUrl(r.url)}
                      onDelete={() => setResults((prev) => prev.filter((img) => img.url !== r.url))}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {tasks.length === 0 && results.length === 0 && !loadingHistory && (
            <EmptyState
              icon={Wand2}
              tone="pink"
              title="Configure e clique em Gerar"
              description="Escreva um prompt no painel ao lado. As imagens geradas aparecem aqui e ficam salvas no histórico."
              className="min-h-[28rem] border-0 bg-transparent"
            />
          )}
        </div>
      </div>

      {/* Fullscreen viewer */}
      {fullscreenUrl && (
        <FullscreenViewer url={fullscreenUrl} onClose={() => setFullscreenUrl(null)} />
      )}

      {/* Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
