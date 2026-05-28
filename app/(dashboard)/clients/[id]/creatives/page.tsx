import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CreativeGenerator } from "@/components/creatives/creative-generator";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";
import { createClient } from "@/lib/supabase/server";
import { getClientById, getLatestCreativeBrain } from "@/services/clients";
import { getGeneratedCreatives } from "@/services/creatives";
import type { BrandDna } from "@/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientCreativesPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const brain = await getLatestCreativeBrain(id);
  const brandDna = brain?.brand_dna as BrandDna | undefined;
  const templates = brandDna?.nanoBananaPro?.promptTemplates ?? [];

  let creatives: Awaited<ReturnType<typeof getGeneratedCreatives>> = [];
  try {
    creatives = await getGeneratedCreatives(id);
  } catch {
    creatives = [];
  }

  const canGenerate = Boolean(brain && templates.length > 0);

  return (
    <DashboardShell
      title="Criativos"
      description={`${client.name} — geração com Nano Banana`}
    >
      <div className={layout.sectionGap}>
        <Link
          href={`/clients/${id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex gap-2 text-muted-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          Voltar ao cliente
        </Link>

        {!canGenerate ? (
          <div className="surface-panel flex flex-col items-center gap-4 p-10 text-center">
            <Sparkles className="size-10 text-muted-foreground/50" strokeWidth={1.25} />
            <div className="space-y-2">
              <p className="font-medium">Creative Brain necessário</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Gere e aprove um Creative Brain com templates Nano Banana antes
                de criar imagens.
              </p>
            </div>
            <Link
              href={`/clients/${id}/brain`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Ir para Creative Brain
            </Link>
          </div>
        ) : (
          <CreativeGenerator
            clientId={id}
            brainId={brain!.id}
            brandDna={brandDna!}
            templates={templates}
            initialCreatives={creatives}
          />
        )}
      </div>
    </DashboardShell>
  );
}
