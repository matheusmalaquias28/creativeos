import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Brain, Layers, Sparkles, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="relative flex size-9 items-center justify-center rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm dark:bg-white/5">
            <Brain className="size-4 text-foreground/90" strokeWidth={1.75} />
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-positive animate-glow-pulse dark:shadow-[0_0_6px_var(--positive)]" />
          </div>
          <div>
            <span className="block text-sm font-semibold tracking-tight text-foreground">Creative OS</span>
            <span className="block text-[0.5625rem] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
              Operating System
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-full"
            )}
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-8">
        <div className="mx-auto max-w-3xl text-center animate-in-soft">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-positive/20 bg-positive/8 px-3.5 py-1.5 dark:border-positive/15 dark:bg-positive/6">
            <span className="size-1.5 rounded-full bg-positive animate-glow-pulse dark:shadow-[0_0_4px_var(--positive)]" />
            <span className="text-[0.6875rem] font-medium tracking-[0.1em] uppercase text-positive">
              Creative Operating System
            </span>
          </div>

          <h1 className="text-display text-foreground">
            Brand intelligence para equipes criativas de elite
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Automatize onboarding, Brand DNA e direção visual com precisão.
            Uma plataforma interna calma, estruturada e feita para agências
            modernas.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "inline-flex gap-2 rounded-full"
              )}
            >
              Acessar plataforma
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mx-auto mt-24 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: Layers,
              label: "Onboarding",
              desc: "Contexto de marca estruturado desde o primeiro contato.",
            },
            {
              icon: Brain,
              label: "Creative Brain",
              desc: "Brand DNA gerado com IA e revisado pela equipe.",
            },
            {
              icon: Zap,
              label: "Criativos",
              desc: "Base preparada para geração automatizada de campanhas.",
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={cn(
                  "surface-panel p-6 text-left animate-in-soft hover-lift",
                  i === 1 && "stagger-1",
                  i === 2 && "stagger-2"
                )}
              >
                <div className="mb-4 flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/50 dark:border-white/8 dark:bg-white/5">
                  <Icon className="size-4 text-foreground/80" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {item.label}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
