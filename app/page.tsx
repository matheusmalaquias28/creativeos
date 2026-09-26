import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Brain, ClipboardList, Layers, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { homePathFor, parseRole } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandMark, BrandWordmark } from "@/components/layout/brand-mark";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

const features: { icon: typeof Brain; tone: Tone; label: string; desc: string }[] = [
  {
    icon: ClipboardList,
    tone: "cyan",
    label: "Demandas",
    desc: "Briefings chegam do Make direto no kanban, com prazo, status e entrega no Drive.",
  },
  {
    icon: Brain,
    tone: "violet",
    label: "Creative Brain",
    desc: "Brand DNA de cada cliente gerado com IA e revisado pela equipe.",
  },
  {
    icon: Wand2,
    tone: "pink",
    label: "Gerador",
    desc: "Artes a partir do DNA visual e das referências do cliente.",
  },
  {
    icon: Layers,
    tone: "lime",
    label: "Carrosséis",
    desc: "Editor de carrosséis com perfis de design reutilizáveis.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(homePathFor(parseRole(user.app_metadata?.role)));
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-3">
          <BrandMark />
          <BrandWordmark />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Entrar
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pt-10 pb-24">
        <div className="mx-auto max-w-3xl animate-in-soft text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 shadow-[var(--surface-shadow)]">
            <span className="size-1.5 rounded-full bg-highlight shadow-[0_0_8px_var(--highlight)]" />
            <span className="text-xs font-semibold text-muted-foreground">
              Creative Operating System
            </span>
          </div>

          <h1 className="text-display text-foreground">
            Brand intelligence para{" "}
            <span className="bg-[linear-gradient(90deg,var(--tone-violet),var(--tone-pink)_55%,var(--tone-lime))] bg-clip-text text-transparent">
              equipes criativas
            </span>{" "}
            de elite
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Onboarding, Brand DNA, demandas e produção de artes em um workspace
            calmo, organizado e feito para agências modernas.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "inline-flex")}>
              Acessar plataforma
              <ArrowRight className="size-4" strokeWidth={2.25} />
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={cn(
                  "surface-panel hover-lift animate-in-soft p-5 text-left",
                  `stagger-${i + 1}`
                )}
              >
                <span
                  className={cn(
                    "mb-4 flex size-10 items-center justify-center rounded-xl",
                    tones[item.tone].iconTile
                  )}
                >
                  <Icon className="size-[1.125rem]" strokeWidth={2} />
                </span>
                <p className="text-sm font-bold tracking-tight text-foreground">{item.label}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
