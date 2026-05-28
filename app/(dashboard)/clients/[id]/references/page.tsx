import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ReferenceUpload } from "@/components/clients/reference-upload";
import { ReferenceGallery } from "@/components/clients/reference-gallery";
import { buttonVariants } from "@/components/ui/button";
import {
  Surface,
  SurfaceContent,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";
import { createClient } from "@/lib/supabase/server";
import { getClientById, getClientReferences } from "@/services/clients";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReferencesPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const references = await getClientReferences(id);

  return (
    <DashboardShell
      title="Referências visuais"
      description={`${client.name} · inspirações para o Brand DNA`}
    >
      <div className={layout.sectionGap}>
        <Surface variant="elevated">
          <SurfaceHeader>
            <SurfaceTitle>Upload</SurfaceTitle>
            <SurfaceDescription>
              Envie múltiplas imagens de referência. Elas serão usadas como
              contexto na geração do Creative Brain.
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceContent>
            <ReferenceUpload clientId={id} />
          </SurfaceContent>
        </Surface>

        <Surface>
          <SurfaceHeader>
            <SurfaceTitle>Galeria ({references.length})</SurfaceTitle>
          </SurfaceHeader>
          <SurfaceContent>
            <ReferenceGallery clientId={id} references={references} />
          </SurfaceContent>
        </Surface>

        <Link
          href={`/clients/${id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex gap-2 text-muted-foreground"
          )}
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Voltar ao cliente
        </Link>
      </div>
    </DashboardShell>
  );
}
