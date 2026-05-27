import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Brain } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
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
      <header className="flex items-center justify-between px-8 py-6 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm">
            <Brain className="size-4 text-foreground/90" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium tracking-heading">Creative OS</span>
        </div>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground"
          )}
        >
          Entrar
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-8">
        <div className="mx-auto max-w-3xl text-center animate-in-soft">
          <p className="mb-6 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Creative Operating System
          </p>
          <h1 className="text-display text-foreground">
            Brand intelligence para equipes criativas de elite
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Automatize onboarding, Brand DNA e direção visual com precisão.
            Uma plataforma interna calma, estruturada e feita para agências
            modernas.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg" }), "inline-flex gap-2")}
            >
              Acessar plataforma
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-24 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              label: "Onboarding",
              desc: "Contexto de marca estruturado desde o primeiro contato.",
            },
            {
              label: "Creative Brain",
              desc: "Brand DNA gerado com IA e revisado pela equipe.",
            },
            {
              label: "Criativos",
              desc: "Base preparada para geração automatizada de campanhas.",
            },
          ].map((item, i) => (
            <div
              key={item.label}
              className={cn(
                "surface-panel p-6 text-left animate-in-soft",
                i === 1 && "stagger-1",
                i === 2 && "stagger-2"
              )}
            >
              <p className="text-sm font-medium tracking-heading text-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
