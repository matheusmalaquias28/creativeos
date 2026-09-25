import type { LucideIcon } from "lucide-react";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

/**
 * Tom de cada tipo de nó do fluxo — o mesmo mapa alimenta o header dos nós,
 * a paleta "Adicionar" e o minimapa, então a cor identifica o tipo em todo lugar.
 */
export const FLOW_NODE_TONE = {
  clienteLogo: "blue",
  clienteReferencias: "violet",
  promptArte: "amber",
  gerarImagem: "pink",
  saidaArte: "green",
  referenciaImagem: "orange",
} as const satisfies Record<string, Tone>;

/** Handle padrão dos nós (conector em violeta de marca). */
export const flowHandleClass =
  "!size-3 !rounded-full !border-2 !border-card !bg-primary transition-transform hover:!scale-125";

type NodeShellProps = {
  tone: Tone;
  icon: LucideIcon;
  title: React.ReactNode;
  /** Conteúdo à direita do título (contador, ação). */
  meta?: React.ReactNode;
  /** Ícone alternativo no tile (ex.: spinner durante a geração). */
  iconNode?: React.ReactNode;
  selected?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
};

/** Painel base dos nós do canvas: card + header com tile de ícone no tom do tipo. */
export function NodeShell({
  tone,
  icon: Icon,
  title,
  meta,
  iconNode,
  selected,
  className,
  bodyClassName,
  children,
}: NodeShellProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card text-card-foreground shadow-[var(--surface-shadow),var(--inner-highlight)] transition-premium",
        selected
          ? "border-primary/60 ring-2 ring-primary/20"
          : "border-border hover:border-border-strong",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-lg",
            tones[tone].iconTile
          )}
        >
          {iconNode ?? <Icon className="size-3.5" strokeWidth={2} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold tracking-tight text-foreground">
          {title}
        </span>
        {meta}
      </div>
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </div>
  );
}

/** Área de preview de imagem vazia (placeholder) dentro de um nó. */
export function NodeImagePlaceholder({
  icon: Icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface",
        className
      )}
    >
      <Icon className="size-5 text-muted-foreground/50" strokeWidth={1.5} />
      {children}
    </div>
  );
}
