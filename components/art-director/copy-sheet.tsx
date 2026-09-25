import { cn } from "@/lib/utils";

export type BriefingCopy = {
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
};

export function copyFromParams(params: Record<string, unknown> | null): BriefingCopy {
  const p = params ?? {};
  return {
    headline: (p.headline as string) ?? null,
    subheadline: (p.subheadline as string) ?? null,
    cta: (p.cta as string) ?? null,
    informacoesExtras: (p.informacoesExtras as string) ?? null,
  };
}

const LABELS: { key: keyof BriefingCopy; label: string }[] = [
  { key: "headline", label: "Headline" },
  { key: "subheadline", label: "Subheadline" },
  { key: "cta", label: "CTA" },
  { key: "informacoesExtras", label: "Extras" },
];

/**
 * A copy exata que veio no briefing, do lado da arte.
 *
 * É a cola de conferência na aprovação: o erro que passa despercebido não é a
 * estética, é a arte com o texto trocado, com acento comido ou com uma frase
 * que o modelo inventou. Conferir de memória, 400 vezes por mês, não funciona.
 */
export function CopySheet({
  copy,
  className,
  dense = false,
}: {
  copy: BriefingCopy;
  className?: string;
  dense?: boolean;
}) {
  const rows = LABELS.filter(({ key }) => Boolean(copy[key]?.toString().trim()));
  if (rows.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Esta arte veio sem copy no briefing.
      </p>
    );
  }

  return (
    <dl
      className={cn(
        "rounded-xl border border-border/60 bg-muted/40 dark:border-white/6 dark:bg-white/3",
        dense ? "space-y-1.5 p-3" : "space-y-2 p-3.5",
        className
      )}
    >
      {rows.map(({ key, label }) => (
        <div key={key} className="space-y-0.5">
          <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd
            className={cn(
              "leading-snug text-foreground/90",
              key === "headline" ? "text-sm font-medium" : "text-xs"
            )}
          >
            {/* select-all: conferir é comparar caractere a caractere, e às vezes copiar */}
            <span className="select-all">{copy[key]}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
