"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/carousel/tweet/tweet-card-canvas";
import { createTweetProfileAction, deleteTweetProfileAction } from "@/actions/tweet-carousels";
import { normalizeHandle, type TweetProfile } from "@/types/tweet-carousel";

type Step = "profile" | "new-profile" | "mode" | "input" | "generating";
type Mode = "ai" | "manual";

function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      {children}
    </button>
  );
}

/** Fluxo do carrossel tweet dentro do modal do gerador: perfil → modo → conteúdo. */
export function TweetWizard({
  profiles: initialProfiles,
  onBack,
}: {
  profiles: TweetProfile[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [step, setStep] = useState<Step>(initialProfiles.length ? "profile" : "new-profile");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("ai");
  const [input, setInput] = useState("");
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // novo perfil
  const [newName, setNewName] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const selected = profiles.find((p) => p.id === profileId) ?? null;

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "avatar");
      const res = await fetch("/api/carousel/tweet/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error ?? "Falha no upload");
      setAvatarUrl(data.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function createProfile() {
    setCreating(true);
    const res = await createTweetProfileAction({ name: newName, handle: newHandle, avatarUrl });
    setCreating(false);
    if (res.error || !res.profile) {
      toast.error(res.error ?? "Erro ao criar o perfil");
      return;
    }
    setProfiles((p) => [res.profile!, ...p]);
    setProfileId(res.profile.id);
    setNewName("");
    setNewHandle("");
    setAvatarUrl(null);
    setStep("mode");
  }

  async function removeProfile(p: TweetProfile) {
    if (!confirm(`Excluir o perfil ${p.name}? Os carrosséis já criados continuam iguais.`)) return;
    const res = await deleteTweetProfileAction(p.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setProfiles((list) => list.filter((x) => x.id !== p.id));
  }

  async function generate() {
    if (!profileId || !input.trim()) return;
    setStep("generating");
    setError(null);
    try {
      const res = await fetch("/api/carousel/tweet/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, mode, input: input.trim(), cardCount: cardCount ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.error ?? "Falha ao gerar o carrossel");
      // A rota de API não invalida o Router Cache: sem o refresh, a lista de
      // carrosséis continua em cache sem o novo até recarregar a página.
      router.refresh();
      router.push(`/carousel/tweet/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar o carrossel");
      setStep("input");
    }
  }

  const handlePreview = normalizeHandle(newHandle) || "@seuperfil";

  return (
    <div className="space-y-4">
      {/* Passo 1 — perfil */}
      {step === "profile" && (
        <>
          <BackLink onClick={onBack}>Tipo de carrossel</BackLink>
          <p className="text-sm font-semibold text-foreground">Qual perfil vai aparecer nos cards?</p>
          <div className="space-y-2">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-1 rounded-xl border border-border bg-card pr-1 transition-premium hover:border-primary/50 hover:bg-accent"
              >
                <button
                  onClick={() => {
                    setProfileId(p.id);
                    setStep("mode");
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
                >
                  <Avatar src={p.avatar_url} name={p.name} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                      {p.name}
                      <VerifiedBadge size={15} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{p.handle}</p>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Excluir perfil ${p.name}`}
                  onClick={() => removeProfile(p)}
                  className="opacity-60 group-hover:opacity-100"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full" onClick={() => setStep("new-profile")}>
            <Plus />
            Criar novo perfil
          </Button>
        </>
      )}

      {/* Passo 1b — novo perfil */}
      {step === "new-profile" && (
        <>
          <BackLink onClick={() => (profiles.length ? setStep("profile") : onBack())}>
            {profiles.length ? "Perfis salvos" : "Tipo de carrossel"}
          </BackLink>
          <p className="text-sm font-semibold text-foreground">Novo perfil</p>

          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer" aria-label="Enviar foto do perfil">
              <Avatar src={avatarUrl} name={newName} size={72} />
              <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-popover bg-primary text-primary-foreground">
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  uploadAvatar(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-base font-bold text-foreground">
                {newName.trim() || "Seu nome"}
                <VerifiedBadge size={18} />
              </p>
              <p className="truncate text-sm text-muted-foreground">{handlePreview}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="tweet-name" className="text-[0.8125rem] font-semibold text-foreground">
                Nome
              </label>
              <Input id="tweet-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Estevão Souza" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tweet-handle" className="text-[0.8125rem] font-semibold text-foreground">
                @ do perfil
              </label>
              <Input
                id="tweet-handle"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@oestevaosouza"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">O selo de verificado sai sempre. O perfil fica salvo para os próximos carrosséis.</p>

          <Button
            className="w-full"
            onClick={createProfile}
            disabled={creating || uploading || !newName.trim() || !normalizeHandle(newHandle)}
          >
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            Salvar perfil e continuar
          </Button>
        </>
      )}

      {/* Passo 2 — de onde vem o conteúdo */}
      {step === "mode" && selected && (
        <>
          <BackLink onClick={() => setStep("profile")}>{selected.name}</BackLink>
          <p className="text-sm font-semibold text-foreground">Como vamos montar o conteúdo?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { value: "ai", icon: Sparkles, title: "Criar com IA", desc: "Você manda a ideia e a IA escreve os cards." },
                { value: "manual", icon: FileText, title: "Já tenho o conteúdo", desc: "Cole o texto e a IA só divide em cards." },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setMode(o.value);
                  setError(null);
                  setStep("input");
                }}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-premium hover:border-primary/50 hover:bg-accent"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <o.icon className="size-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">{o.title}</span>
                <span className="text-xs leading-snug text-muted-foreground">{o.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Passo 3 — ideia ou conteúdo */}
      {(step === "input" || step === "generating") && (
        <>
          <BackLink onClick={() => step === "input" && setStep("mode")}>
            {mode === "ai" ? "Criar com IA" : "Já tenho o conteúdo"}
          </BackLink>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {mode === "ai" ? "Qual é a ideia do carrossel?" : "Cole o conteúdo"}
            </p>
            <Textarea
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={step === "generating"}
              placeholder={
                mode === "ai"
                  ? 'Ex: A frase do Joel Jota "quem fala primeiro perde" e por que vendedor que só apresenta ouve "vou pensar"'
                  : "Cole aqui o texto completo. Se já tiver separado em blocos, a divisão é respeitada."
              }
              rows={mode === "ai" ? 5 : 10}
              className="resize-none text-sm"
            />
          </div>

          {mode === "ai" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">Cards</span>
              {[null, 4, 5, 6, 7, 8, 10].map((n) => (
                <button
                  key={n ?? "auto"}
                  type="button"
                  disabled={step === "generating"}
                  onClick={() => setCardCount(n)}
                  className={cn(
                    "h-7 min-w-9 rounded-lg border px-2 text-xs font-semibold tabular-nums transition-premium",
                    cardCount === n
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border bg-surface text-muted-foreground hover:bg-accent"
                  )}
                >
                  {n ?? "Auto"}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-tone-red/25 bg-tone-red/12 p-3 text-sm text-tone-red">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button onClick={generate} disabled={!input.trim() || step === "generating"} className="w-full">
            {step === "generating" ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {step === "generating"
              ? mode === "ai"
                ? "Escrevendo os cards…"
                : "Organizando em cards…"
              : mode === "ai"
                ? "Gerar carrossel"
                : "Organizar em cards"}
          </Button>
        </>
      )}
    </div>
  );
}
