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
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/layout/section-header";
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
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={draft.id ? "Editar perfil" : "Novo perfil"}
        className="animate-in-soft relative z-10 flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]"
      >
        {/* Left: preview */}
        <div className="hidden w-64 shrink-0 flex-col gap-4 border-r border-border bg-surface p-5 sm:flex">
          <p className="text-[0.8125rem] font-semibold text-foreground">Prévia</p>
          {/* Prévia renderiza as cores do perfil (conteúdo) */}
          <ProfilePreview draft={draft} />
          {draft.palette.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.palette.map((c) => (
                <span key={c} className="size-5 rounded border border-border-strong" style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          )}
        </div>

        {/* Right: form */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-heading text-foreground">
                {draft.id ? "Editar perfil" : "Novo perfil"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Logo, fontes e cores reaproveitados nos carrosséis.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
              <X />
            </Button>
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
                  className="h-10 w-full rounded-xl border border-border bg-input px-3.5 text-sm text-foreground outline-none transition-premium hover:border-border-strong focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/20 [&>option]:bg-popover [&>option]:text-popover-foreground"
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
                      : "border-border-strong bg-surface text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleLogo} />
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                  {draft.logo_url ? "Trocar logo" : "Carregar logo"}
                </label>
                {draft.logo_url && (
                  <button
                    onClick={() => patch({ logo_url: null, logo_storage_path: null })}
                    className="text-xs font-semibold text-tone-red hover:underline"
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
              <p className="text-[0.8125rem] font-semibold text-foreground">Cores da marca</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ModernColorPicker label="Fundo" value={draft.color_background} onChange={(v) => patch({ color_background: v })} />
                <ModernColorPicker label="Título" value={draft.color_title} onChange={(v) => patch({ color_title: v })} />
                <ModernColorPicker label="Subtítulo" value={draft.color_subtitle} onChange={(v) => patch({ color_subtitle: v })} />
                <ModernColorPicker label="Destaque" value={draft.color_accent} onChange={(v) => patch({ color_accent: v })} />
              </div>
            </div>

            {/* Business context for Gerador Turbo */}
            <div className="space-y-2.5 rounded-xl border border-tone-pink/25 bg-tone-pink/5 p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-tone-pink/14 text-tone-pink ring-1 ring-inset ring-tone-pink/20">
                  <FileText className="size-3.5" />
                </span>
                <p className="text-[0.8125rem] font-semibold text-foreground">Contexto do cliente (Gerador Turbo)</p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Descreva o negócio do cliente e o estilo de linguagem. A IA gera um
                contexto (.md) lido toda vez que o Gerador Turbo for usado para este perfil.
              </p>
              <Textarea
                value={draft.business_context ?? ""}
                onChange={(e) => patch({ business_context: e.target.value || null })}
                placeholder="Ex: Loja de suplementos premium para atletas. Tom direto, motivador, sem jargão médico. Foca em performance e resultado..."
                rows={4}
                className="resize-none text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleGenerateContext}
                disabled={genCtx}
              >
                {genCtx ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {draft.context_md ? "Regerar contexto (.md)" : "Gerar contexto (.md)"}
              </Button>
              {draft.context_md && (
                <details className="rounded-xl border border-border bg-card p-2.5">
                  <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
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
            <div className="space-y-2.5 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-tone-cyan/14 text-tone-cyan ring-1 ring-inset ring-tone-cyan/20">
                  <ImagePlus className="size-3.5" />
                </span>
                <p className="text-[0.8125rem] font-semibold text-foreground">Imagens de referência (fundos)</p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
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
                      className="size-16 rounded-lg border border-border object-cover"
                    />
                    <button
                      onClick={() => removeReference(ref.url)}
                      className="absolute -top-1.5 -right-1.5 hidden size-5 items-center justify-center rounded-full border border-border bg-popover text-tone-red shadow-[var(--surface-shadow)] group-hover:flex hover:bg-tone-red/15"
                      title="Remover"
                      aria-label="Remover referência"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <label
                  className={cn(
                    "flex size-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[0.625rem] font-semibold transition-colors",
                    "border-border-strong bg-card text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
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
              <p className="text-[0.8125rem] font-semibold text-foreground">Paleta extra</p>
              <div className="flex flex-wrap items-center gap-2">
                {draft.palette.map((c) => (
                  <div key={c} className="group relative">
                    <span className="block size-8 rounded-lg border border-border-strong" style={{ backgroundColor: c }} title={c} />
                    <button
                      onClick={() => patch({ palette: draft.palette.filter((x) => x !== c) })}
                      aria-label="Remover cor"
                      className="absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full border border-border bg-popover text-tone-red shadow-[var(--surface-shadow)] group-hover:flex hover:bg-tone-red/15"
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
                    aria-label="Nova cor"
                    className="size-8 cursor-pointer rounded-lg border border-border bg-transparent"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!draft.palette.includes(newSwatch)) {
                        patch({ palette: [...draft.palette, newSwatch] });
                      }
                    }}
                  >
                    <Plus /> Cor
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-surface/60 px-6 py-4">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || uploading}>
              {saving ? <Loader2 className="animate-spin" /> : null}
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
    <div className="surface-panel hover-lift group flex flex-col overflow-hidden p-2">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${profile.name}`}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ProfilePreview draft={profile} />
      </button>
      <div className="flex items-start justify-between gap-2 px-2 pt-3 pb-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-foreground">{profile.name}</p>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {clientName ?? "Sem cliente"}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon-xs" onClick={onEdit} title="Editar" aria-label="Editar perfil">
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            title="Deletar"
            aria-label="Deletar perfil"
            className="hover:bg-tone-red/12 hover:text-tone-red"
          >
            <Trash2 />
          </Button>
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

  const newButton = (
    <Button size="sm" onClick={() => setEditing(makeEmptyProfileDraft())}>
      <Plus />
      Novo perfil
    </Button>
  );

  return (
    <>
      {profiles.length === 0 ? (
        <EmptyState
          icon={Palette}
          tone="violet"
          title="Nenhum perfil ainda"
          description="Crie perfis de design pré-configurados (logo, fontes e cores) por cliente para reaproveitar em qualquer carrossel."
          action={
            <Button size="sm" onClick={() => setEditing(makeEmptyProfileDraft())}>
              <Plus />
              Criar primeiro perfil
            </Button>
          }
        />
      ) : (
        <section className="space-y-4">
          <SectionHeader
            icon={Palette}
            tone="violet"
            title="Perfis salvos"
            description={`${profiles.length} ${profiles.length === 1 ? "perfil" : "perfis"}`}
            action={newButton}
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
        </section>
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
