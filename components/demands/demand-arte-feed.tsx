import { CopyArteTextsButton } from "@/components/demands/copy-arte-texts-button";
import type { DemandArte } from "@/types/demand";

function ExternalHref({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
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

export function DemandArteFeed({ artes }: { artes: DemandArte[] }) {
  if (artes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma arte no briefing desta demanda.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {artes.map((arte, index) => (
        <article
          key={`${arte.headline}-${index}`}
          className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-100"
        >
          <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
      ))}
    </div>
  );
}
