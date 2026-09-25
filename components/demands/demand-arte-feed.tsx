"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, FileText, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { CopyArteTextsButton } from "@/components/demands/copy-arte-texts-button";
import { updateDemandArtesAction } from "@/actions/demands";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { DemandArte } from "@/types/demand";

function ExternalHref({ href, label }: { href: string; label: string }) {
  if (!href || href.toLowerCase() === "ntem") return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

const EMPTY_ARTE: DemandArte = {
  headline: "",
  subheadline: "",
  informacoesExtras: "",
  cta: "",
  linkReferencias: "",
  imagensReferencias: [],
};

export function DemandArteFeed({
  demandId,
  artes: initialArtes,
}: {
  demandId: string;
  artes: DemandArte[];
}) {
  const router = useRouter();
  const [artes, setArtes] = useState<DemandArte[]>(initialArtes);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<DemandArte>(EMPTY_ARTE);
  const [saving, setSaving] = useState(false);

  function startEdit(index: number) {
    setEditing(index);
    setDraft({ ...EMPTY_ARTE, ...artes[index] });
  }

  function cancel() {
    setEditing(null);
    setDraft(EMPTY_ARTE);
  }

  async function save(index: number) {
    setSaving(true);
    const next = artes.map((a, i) => (i === index ? draft : a));
    const res = await updateDemandArtesAction(demandId, next);
    setSaving(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }
    setArtes(next);
    setEditing(null);
    setDraft(EMPTY_ARTE);
    toast.success(`Arte ${index + 1} atualizada`);
    router.refresh();
  }

  if (artes.length === 0) {
    return (
      <EmptyState
        compact
        icon={FileText}
        tone="slate"
        title="Nenhuma arte no briefing desta demanda."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {artes.map((arte, index) => {
        const isEditing = editing === index;

        if (isEditing) {
          return (
            <article
              key={`edit-${index}`}
              className="surface-panel-elevated relative flex flex-col gap-2.5 p-4 ring-1 ring-primary/30"
            >
              <span className="inline-flex w-fit items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary">
                Editando arte {index + 1}
              </span>

              <ArteField
                label="Headline"
                value={draft.headline}
                onChange={(v) => setDraft((d) => ({ ...d, headline: v }))}
                multiline
                disabled={saving}
              />
              <ArteField
                label="Subheadline"
                value={draft.subheadline}
                onChange={(v) => setDraft((d) => ({ ...d, subheadline: v }))}
                multiline
                disabled={saving}
              />
              <ArteField
                label="Informações extras"
                value={draft.informacoesExtras}
                onChange={(v) => setDraft((d) => ({ ...d, informacoesExtras: v }))}
                multiline
                disabled={saving}
              />
              <ArteField
                label="CTA"
                value={draft.cta}
                onChange={(v) => setDraft((d) => ({ ...d, cta: v }))}
                disabled={saving}
              />
              <ArteField
                label="Link de referências"
                value={draft.linkReferencias}
                onChange={(v) => setDraft((d) => ({ ...d, linkReferencias: v }))}
                disabled={saving}
              />

              <div className="mt-1 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancel}
                  disabled={saving}
                >
                  <X className="size-3.5" />
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => save(index)}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Salvar
                </Button>
              </div>
            </article>
          );
        }

        return (
          <article
            key={`${arte.headline}-${index}`}
            className="surface-panel hover-lift group relative aspect-[3/4] overflow-hidden"
          >
            <div className="absolute right-2 top-2 z-10 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => startEdit(index)}
                title="Editar textos"
                className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-popover text-foreground shadow-[var(--surface-shadow)] transition-premium hover:border-border-strong hover:bg-accent"
              >
                <Pencil className="size-3" />
                <span className="sr-only">Editar textos</span>
              </button>
              <CopyArteTextsButton
                arte={arte}
                arteIndex={index}
                iconOnly
                className="bg-popover"
              />
            </div>

            <div className="flex h-full flex-col px-4 pb-4 pt-5 sm:px-5">
              <span className="inline-flex w-fit items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                Arte {index + 1}
              </span>

              <div className="mt-4 flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                {arte.headline ? (
                  <h3 className="line-clamp-4 text-base font-bold leading-snug tracking-tight text-foreground sm:text-lg">
                    {arte.headline}
                  </h3>
                ) : (
                  <h3 className="text-sm font-medium text-muted-foreground/70">Sem headline</h3>
                )}
                {arte.subheadline ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {arte.subheadline}
                  </p>
                ) : null}
                {arte.informacoesExtras ? (
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground/80">
                    {arte.informacoesExtras}
                  </p>
                ) : null}
              </div>

              <div className="mt-auto space-y-2 pt-3">
                {arte.imagensReferencias.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {arte.imagensReferencias.map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Referência ${i + 1}`}
                        className="relative size-8 overflow-hidden rounded-md border border-border bg-muted"
                      >
                        <Image
                          src={url}
                          alt={`Referência ${i + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="32px"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {arte.cta ? (
                  <div className="rounded-full bg-primary/15 px-3 py-2 text-center text-xs font-semibold text-primary ring-1 ring-inset ring-primary/25">
                    <span className="line-clamp-2">{arte.cta}</span>
                  </div>
                ) : (
                  <div className="h-9" />
                )}
                <ExternalHref href={arte.linkReferencias} label="Referências" />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const FIELD_BASE =
  "w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-sm text-foreground transition-premium placeholder:text-muted-foreground/70 hover:border-border-strong focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-60";

function ArteField({
  label,
  value,
  onChange,
  multiline,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {multiline ? (
        <AutoTextarea value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={FIELD_BASE}
        />
      )}
    </label>
  );
}

/** Textarea que cresce com o conteúdo — sem rolagem vertical. */
function AutoTextarea({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={1}
      className={cn(FIELD_BASE, "resize-none overflow-hidden leading-relaxed")}
    />
  );
}
