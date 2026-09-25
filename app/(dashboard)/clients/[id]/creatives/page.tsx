import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { CreativeGenerator } from "@/components/creatives/creative-generator";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
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
      description="Monte um prompt para o Magnific Spaces a partir do Brand DNA do cliente."
      backHref={`/clients/${id}`}
      backLabel={client.name}
    >
      {!brandDna ? (
        <EmptyState
          icon={Sparkles}
          tone="pink"
          title="Creative Brain necessário"
          description="Gere um Creative Brain antes de criar prompts para este cliente."
          action={
            <Link href={`/clients/${id}/brain`} className={cn(buttonVariants())}>
              Ir para Creative Brain
            </Link>
          }
        />
      ) : (
        <CreativeGenerator brandDna={brandDna} clientName={client.name} />
      )}
    </DashboardPage>
  );
}
