import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { CreativeGenerator } from "@/components/creatives/creative-generator";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";
import { getAuthUser } from "@/lib/auth/session";
import { getClientById, getLatestCreativeBrain } from "@/services/clients";
import type { BrandDna } from "@/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientCreativesPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const brain = await getLatestCreativeBrain(id);
  const brandDna = brain?.brand_dna as BrandDna | undefined;

  return (
    <DashboardPage
      title="Gerar prompt"
      description={`${client.name} — prompt para Magnific Spaces`}
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

        {!brandDna ? (
          <div className="surface-panel flex flex-col items-center gap-4 p-10 text-center">
            <Sparkles className="size-10 text-muted-foreground/50" strokeWidth={1.25} />
            <div className="space-y-2">
              <p className="font-medium">Creative Brain necessário</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Gere um Creative Brain antes de criar prompts para este cliente.
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
          <CreativeGenerator brandDna={brandDna} clientName={client.name} />
        )}
      </div>
    </DashboardPage>
  );
}
