"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { CopyArteTextsButton } from "@/components/demands/copy-arte-texts-button";
import { updateDemandArtesAction } from "@/actions/demands";
import { cn } from "@/lib/utils";
import type { DemandArte } from "@/types/demand";

function ExternalHref({ href, label }: { href: string; label: string }) {
  if (!href || href.toLowerCase() === "ntem") return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
    >
      {label}
    </a>
  );
}

const EMPTY_ARTE: DemandArte = {
  headline: "",
  subheadline: "",
  informacoesExtras: "",
  cta: "",
  linkReferencias: "",
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
      <p className="text-sm text-muted-foreground">
        Nenhuma arte no briefing desta demanda.
      </p>
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
              className="relative flex flex-col gap-2 rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-500 dark:bg-zinc-100"
            >
              <p className="text-[10px] font-medium tracking-[0.14em] text-zinc-400 uppercase">
                Arte {index + 1}
              </p>

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
                <button
                  type="button"
                  onClick={cancel}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <X className="size-3.5" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => save(index)}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Salvar
                </button>
              </div>
            </article>
          );
        }

        return (
          <article
            key={`${arte.headline}-${index}`}
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-100"
          >
            <div className="absolute right-2 top-2 z-10 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => startEdit(index)}
                title="Editar textos"
                className="inline-flex size-7 items-center justify-center rounded-lg border border-zinc-300 bg-white/90 text-zinc-900 shadow-sm backdrop-blur-sm hover:bg-white dark:border-zinc-400 dark:bg-zinc-50 dark:text-zinc-900"
              >
                <Pencil className="size-3" />
                <span className="sr-only">Editar textos</span>
              </button>
              <CopyArteTextsButton
                arte={arte}
                arteIndex={index}
                iconOnly
                className="border-zinc-300 bg-white/90 text-zinc-900 shadow-sm backdrop-blur-sm hover:bg-white dark:border-zinc-400 dark:bg-zinc-50 dark:text-zinc-900"
              />
            </div>

            <div className="flex h-full flex-col px-4 pb-4 pt-5 sm:px-5">
              <p className="text-[10px] font-medium tracking-[0.14em] text-zinc-400 uppercase">
                Arte {index + 1}
              </p>

              <div className="mt-4 flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                {arte.headline ? (
                  <h3 className="line-clamp-4 text-base font-semibold leading-snug tracking-tight text-zinc-950 sm:text-lg">
                    {arte.headline}
                  </h3>
                ) : (
                  <h3 className="text-sm font-medium text-zinc-400">Sem headline</h3>
                )}
                {arte.subheadline ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-600">
                    {arte.subheadline}
                  </p>
                ) : null}
                {arte.informacoesExtras ? (
                  <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-zinc-500">
                    {arte.informacoesExtras}
                  </p>
                ) : null}
              </div>

              <div className="mt-auto space-y-2 pt-3">
                {arte.cta ? (
                  <div className="rounded-full bg-zinc-950 px-3 py-2 text-center text-[11px] font-medium text-white">
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
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-60";

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
      <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>
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
