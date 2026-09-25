import Link from "next/link";
import { Brain, ClipboardList, Wand2 } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandMark, BrandWordmark } from "@/components/layout/brand-mark";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

const highlights = [
  {
    icon: ClipboardList,
    tone: "cyan" as const,
    title: "Demandas em fluxo",
    text: "Briefings do Make direto no kanban, com prazo e status sincronizados.",
  },
  {
    icon: Brain,
    tone: "violet" as const,
    title: "Creative Brain",
    text: "Brand DNA de cada cliente gerado por IA e revisado pela equipe.",
  },
  {
    icon: Wand2,
    tone: "lime" as const,
    title: "Estúdio de artes",
    text: "Gerador, carrosséis e curadoria no mesmo workspace.",
  },
];

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca */}
      <aside className="relative hidden overflow-hidden border-r border-border bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_0%_0%,color-mix(in_oklch,var(--primary)_30%,transparent),transparent_70%),radial-gradient(55%_45%_at_100%_100%,color-mix(in_oklch,var(--highlight)_14%,transparent),transparent_70%)]"
        />
        <div aria-hidden className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />

        <Link href="/" className="relative flex items-center gap-3">
          <BrandMark size="md" />
          <BrandWordmark />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-[2.5rem] leading-[1.08] font-bold tracking-[-0.035em]">
            Toda a operação criativa da agência,{" "}
            <span className="bg-[linear-gradient(90deg,var(--tone-violet),var(--tone-lime))] bg-clip-text text-transparent">
              em um só lugar.
            </span>
          </h2>
          <ul className="mt-10 space-y-5">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex gap-4">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      tones[item.tone].iconTile
                    )}
                  >
                    <Icon className="size-[1.125rem]" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {item.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Creative OS · Uso interno
        </p>
      </aside>

      {/* Formulário */}
      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 lg:justify-end lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 lg:hidden">
            <BrandMark size="sm" />
            <span className="text-sm font-bold tracking-tight">Creative OS</span>
          </Link>
          <ThemeToggle compact />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-[400px] animate-in-soft">{children}</div>
        </div>
      </div>
    </div>
  );
}
