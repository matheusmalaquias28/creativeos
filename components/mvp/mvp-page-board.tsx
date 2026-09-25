import type { MvpPage } from "@/types/mvp";

type Props = {
  pages: MvpPage[];
};

/**
 * Quadro de preview do MVP: cada card usa aspect-ratio A4 (210/297) e renderiza
 * os blocos organizados pela IA como eles vão aparecer na página. As referências
 * visuais são globais (uploader próprio na página do projeto), então o card é
 * puramente informativo.
 */
export function MvpPageBoard({ pages }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {pages.map((page) => (
        <MvpPageCard key={page.index} page={page} />
      ))}
    </div>
  );
}

function MvpPageCard({ page }: { page: MvpPage }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-bold text-muted-foreground tabular-nums">
          Página {page.index + 1}
        </span>
        <p className="max-w-[65%] truncate text-xs font-medium text-muted-foreground">{page.title}</p>
      </div>

      {/* Folha A4 — preview fiel do papel impresso: as cores neutras claras são
          intencionais (representam a página final, independente do tema do app). */}
      <div className="aspect-[210/297] overflow-hidden rounded-xl border border-border bg-neutral-50 text-neutral-900 shadow-[var(--surface-shadow-elevated)] transition-premium hover:shadow-[var(--surface-shadow-hover)]">
        <div className="flex h-full flex-col gap-2.5 overflow-hidden p-[8%]">
          {page.blocks.map((block, i) => {
            switch (block.type) {
              case "title":
                return (
                  <p key={i} className="text-[clamp(0.8rem,1.4vw,1.15rem)] font-bold leading-tight">
                    {block.text}
                  </p>
                );
              case "subtitle":
                return (
                  <p key={i} className="text-[clamp(0.65rem,1vw,0.85rem)] font-semibold text-neutral-600">
                    {block.text}
                  </p>
                );
              case "bullet":
                return (
                  <p key={i} className="pl-3 text-[clamp(0.55rem,0.85vw,0.75rem)] leading-snug text-neutral-800 before:mr-1.5 before:content-['•']">
                    {block.text}
                  </p>
                );
              case "quote":
                return (
                  <p key={i} className="border-l-2 border-neutral-300 pl-2 text-[clamp(0.55rem,0.85vw,0.75rem)] italic leading-snug text-neutral-600">
                    {block.text}
                  </p>
                );
              case "cta":
                return (
                  <p key={i} className="mx-auto mt-auto w-fit rounded-md bg-neutral-900 px-3 py-1.5 text-center text-[clamp(0.55rem,0.85vw,0.75rem)] font-semibold text-neutral-50">
                    {block.text}
                  </p>
                );
              default:
                return (
                  <p key={i} className="text-[clamp(0.55rem,0.85vw,0.75rem)] leading-snug text-neutral-800">
                    {block.text}
                  </p>
                );
            }
          })}
        </div>
      </div>
    </div>
  );
}
