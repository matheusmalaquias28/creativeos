"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Plus,
  Palette,
  Trash2,
  Loader2,
  ImagePlus,
  X,
  Pencil,
  Sparkles,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Surface, SurfaceContent } from "@/components/ui/surface";
import { ModernColorPicker, FontPicker } from "@/components/carousel/controls/pickers";
import {
  saveCarouselProfileAction,
  deleteCarouselProfileAction,
  generateProfileContextAction,
} from "@/actions/carousel-profiles";
import { makeEmptyProfileDraft } from "@/types/carousel-profile";
import type {
  CarouselProfile,
  CarouselProfileDraft,
} from "@/types/carousel-profile";

type ClientOption = { id: string; name: string };

function ProfilePreview({ draft }: { draft: CarouselProfileDraft }) {
  return (
    <div
      className="relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden rounded-xl p-4"
      style={{ backgroundColor: draft.color_background }}
    >
      {draft.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draft.logo_url}
          alt="logo"
          className="absolute left-3 top-3 h-6 w-auto max-w-[70px] object-contain"
        />
      )}
      <div
        className="text-lg font-extrabold leading-tight"
        style={{ color: draft.color_title, fontFamily: draft.font_title ?? undefined }}
      >
        Título de exemplo
      </div>
      <div
        className="mt-1 text-[0.7rem]"
        style={{ color: draft.color_subtitle, fontFamily: draft.font_body ?? undefined }}
      >
        Subtítulo de apoio da marca
      </div>
      <div
        className="mt-2 h-1.5 w-10 rounded-full"
        style={{ backgroundColor: draft.color_accent }}
      />
    </div>
  );
}

function ProfileEditor({
  draft: initialDraft,
  clients,
  onClose,
  onSaved,
}: {
  draft: CarouselProfileDraft;
  clients: ClientOption[];
  onClose: () => void;
  onSaved: (profile: CarouselProfile) => void;
}) {
  const [draft, setDraft] = useState<CarouselProfileDraft>(initialDraft);
  const [uploading, setUploading] = useState(false);
  const [uploadingRefs, setUploadingRefs] = useState(false);
  const [saving, startSaving] = useTransition();
  const [newSwatch, setNewSwatch] = useState("#3b82f6");
  const [genCtx, setGenCtx] = useState(false);

  function patch(p: Partial<CarouselProfileDraft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  async function handleReferenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingRefs(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/carousel/profiles/upload-image", {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error ?? "Falha no upload");
          return { url: data.url as string, storage_path: data.storagePath as string };
        })
      );
      setDraft((d) => ({ ...d, reference_images: [...d.reference_images, ...uploaded] }));
      toast.success(
        uploaded.length > 1 ? `${uploaded.length} referências enviadas` : "Referência enviada"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploadingRefs(false);
    }
  }

  function removeReference(url: string) {
    setDraft((d) => ({
      ...d,
      reference_images: d.reference_images.filter((r) => r.url !== url),
    }));
  }

  async function handleGenerateContext() {
    if (!draft.business_context?.trim()) {
      toast.error("Escreva as informações do cliente primeiro");
      return;
    }
    setGenCtx(true);
    try {
      const result = await generateProfileContextAction(draft.business_context, draft.name);
      if (result.error) throw new Error(result.error);
      patch({ context_md: result.md ?? null });
      toast.success("Contexto (.md) gerado — revise e salve o perfil");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar contexto");
    } finally {
      setGenCtx(false);
    }
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/carousel/profiles/upload-logo", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Falha no upload");
      patch({ logo_url: data.url, logo_storage_path: data.storagePath });
      toast.success("Logo enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleSave() {
    startSaving(async () => {
      const result = await saveCarouselProfileAction(draft);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Perfil salvo");
      onSaved({
        ...(draft as CarouselProfile),
        id: result.profileId ?? draft.id,
        updated_at: new Date().toISOString(),
        created_at: draft.id ? (draft as CarouselProfile).created_at : new Date().toISOString(),
      } as CarouselProfile);
      onClose();
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
        {/* Left: preview */}
        <div className="hidden w-64 shrink-0 flex-col gap-4 border-r border-border/50 bg-muted/20 p-5 sm:flex">
          <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Prévia
          </p>
          <ProfilePreview draft={draft} />
          {draft.palette.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.palette.map((c) => (
                <span key={c} className="size-5 rounded border border-white/10" style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          )}
        </div>

        {/* Right: form */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
            <h2 className="text-base font-semibold tracking-tight">
              {draft.id ? "Editar perfil" : "Novo perfil"}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Name + client */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nome do perfil</label>
                <Input
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Ex: Marca X — Feed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                <select
                  value={draft.client_id ?? ""}
                  onChange={(e) => patch({ client_id: e.target.value || null })}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary/50 dark:bg-surface-elevated [&>option]:bg-card [&>option]:text-foreground dark:[&>option]:bg-surface-elevated"
                >
                  <option value="">Nenhum</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Logo + handle */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Logo</label>
                <label
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-xs transition-colors",
                    draft.logo_url
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleLogo} />
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                  {draft.logo_url ? "Trocar logo" : "Carregar logo"}
                </label>
                {draft.logo_url && (
                  <button
                    onClick={() => patch({ logo_url: null, logo_storage_path: null })}
                    className="text-[0.625rem] text-negative hover:underline"
                  >
                    Remover logo
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">@ do Instagram</label>
                <Input
                  value={draft.instagram_handle ?? ""}
                  onChange={(e) => patch({ instagram_handle: e.target.value || null })}
                  placeholder="@suamarca"
                />
              </div>
            </div>

            {/* Fonts */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FontPicker
                label="Fonte dos títulos"
                value={draft.font_title ?? ""}
                onChange={(f) => patch({ font_title: f })}
              />
              <FontPicker
                label="Fonte do corpo"
                value={draft.font_body ?? ""}
                onChange={(f) => patch({ font_body: f })}
              />
            </div>

            {/* Colors */}
            <div className="space-y-3">
              <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Cores da marca
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ModernColorPicker label="Fundo" value={draft.color_background} onChange={(v) => patch({ color_background: v })} />
                <ModernColorPicker label="Título" value={draft.color_title} onChange={(v) => patch({ color_title: v })} />
                <ModernColorPicker label="Subtítulo" value={draft.color_subtitle} onChange={(v) => patch({ color_subtitle: v })} />
                <ModernColorPicker label="Destaque" value={draft.color_accent} onChange={(v) => patch({ color_accent: v })} />
              </div>
            </div>

            {/* Business context for Gerador Turbo */}
            <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3">
              <div className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" />
                <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Contexto do cliente (Gerador Turbo)
                </p>
              </div>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground/60">
                Descreva o negócio do cliente e o estilo de linguagem. A IA gera um
                contexto (.md) lido toda vez que o Gerador Turbo for usado para este perfil.
              </p>
              <Textarea
                value={draft.business_context ?? ""}
                onChange={(e) => patch({ business_context: e.target.value || null })}
                placeholder="Ex: Loja de suplementos premium para atletas. Tom direto, motivador, sem jargão médico. Foca em performance e resultado..."
                rows={4}
                className="text-xs resize-none"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={handleGenerateContext}
                disabled={genCtx}
              >
                {genCtx ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {draft.context_md ? "Regerar contexto (.md)" : "Gerar contexto (.md)"}
              </Button>
              {draft.context_md && (
                <details className="rounded-lg border border-border/40 bg-background/40 p-2">
                  <summary className="cursor-pointer text-[0.625rem] font-medium text-muted-foreground">
                    Ver contexto gerado
                  </summary>
                  <Textarea
                    value={draft.context_md}
                    onChange={(e) => patch({ context_md: e.target.value })}
                    rows={8}
                    className="mt-2 text-[0.7rem] font-mono resize-none"
                  />
                </details>
              )}
            </div>

            {/* Reference images (backgrounds) */}
            <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3">
              <div className="flex items-center gap-1.5">
                <ImagePlus className="size-3.5 text-primary" />
                <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Imagens de referência (fundos)
                </p>
              </div>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground/60">
                Envie imagens que representem o estilo visual da marca. Elas guiam a
                geração das imagens de fundo dos carrosséis no Gerador Turbo.
              </p>
              <div className="flex flex-wrap gap-2">
                {draft.reference_images.map((ref) => (
                  <div key={ref.url} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ref.url}
                      alt="referência"
                      className="size-16 rounded-lg border border-white/10 object-cover"
                    />
                    <button
                      onClick={() => removeReference(ref.url)}
                      className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full bg-negative text-white group-hover:flex"
                      title="Remover"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <label
                  className={cn(
                    "flex size-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[0.55rem] transition-colors",
                    "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="sr-only"
                    onChange={handleReferenceUpload}
                  />
                  {uploadingRefs ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="size-4" />
                      Adicionar
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Palette */}
            <div className="space-y-2">
              <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Paleta extra
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {draft.palette.map((c) => (
                  <div key={c} className="group relative">
                    <span className="block size-8 rounded-lg border border-white/10" style={{ backgroundColor: c }} title={c} />
                    <button
                      onClick={() => patch({ palette: draft.palette.filter((x) => x !== c) })}
                      className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-negative text-white group-hover:flex"
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={newSwatch}
                    onChange={(e) => setNewSwatch(e.target.value)}
                    className="size-8 cursor-pointer rounded-lg border border-border bg-transparent"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      if (!draft.palette.includes(newSwatch)) {
                        patch({ palette: [...draft.palette, newSwatch] });
                      }
                    }}
                  >
                    <Plus className="size-3" /> Cor
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/50 px-6 py-4">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || uploading}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Salvar perfil
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ProfileCard({
  profile,
  clientName,
  onEdit,
  onDelete,
}: {
  profile: CarouselProfile;
  clientName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border/50 bg-card transition-premium hover-lift dark:border-white/7">
      <div className="p-3">
        <ProfilePreview draft={profile} />
      </div>
      <div className="flex items-start justify-between gap-2 px-4 pb-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{profile.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {clientName ?? "Sem cliente"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            title="Editar"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-negative/10 hover:text-negative transition-colors"
            title="Deletar"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProfilesManager({
  initialProfiles,
  clients,
}: {
  initialProfiles: CarouselProfile[];
  clients: ClientOption[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [editing, setEditing] = useState<CarouselProfileDraft | null>(null);

  const clientName = (id: string | null) =>
    id ? clients.find((c) => c.id === id)?.name : undefined;

  async function handleDelete(profile: CarouselProfile) {
    if (!confirm(`Deletar o perfil "${profile.name}"?`)) return;
    const prev = profiles;
    setProfiles((p) => p.filter((x) => x.id !== profile.id));
    const result = await deleteCarouselProfileAction(profile.id);
    if (result.error) {
      toast.error(result.error);
      setProfiles(prev);
    } else {
      toast.success("Perfil deletado");
    }
  }

  function handleSaved(saved: CarouselProfile) {
    setProfiles((p) => {
      const exists = p.some((x) => x.id === saved.id);
      return exists ? p.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...p];
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setEditing(makeEmptyProfileDraft())}>
          <Plus className="size-4" />
          Novo perfil
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Surface variant="dashed" padding="lg">
          <SurfaceContent className="flex flex-col items-center text-center">
            <Palette className="mb-4 size-8 text-muted-foreground/40" strokeWidth={1.25} />
            <p className="text-sm font-medium text-foreground">Nenhum perfil ainda</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Crie perfis de design pré-configurados (logo, fontes e cores) por
              cliente para reaproveitar em qualquer carrossel.
            </p>
            <div className="mt-4">
              <Button size="sm" className="gap-1.5" onClick={() => setEditing(makeEmptyProfileDraft())}>
                <Plus className="size-4" />
                Criar primeiro perfil
              </Button>
            </div>
          </SurfaceContent>
        </Surface>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              clientName={clientName(profile.client_id)}
              onEdit={() => setEditing({ ...profile, reference_images: profile.reference_images ?? [] })}
              onDelete={() => handleDelete(profile)}
            />
          ))}
        </div>
      )}

      {editing && (
        <ProfileEditor
          draft={editing}
          clients={clients}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
