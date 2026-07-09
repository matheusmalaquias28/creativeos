import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { ReferenceUpload } from "@/components/clients/reference-upload";
import { ReferenceGallery } from "@/components/clients/reference-gallery";
import { ClientPhotosPanel } from "@/components/clients/client-photos-panel";
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
import { getAuthUser } from "@/lib/auth/session";
import { getClientById, getClientReferences } from "@/services/clients";
import { getClientPhotos } from "@/services/client-photos";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReferencesPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const [references, clientPhotos] = await Promise.all([
    getClientReferences(id),
    getClientPhotos(id),
  ]);

  return (
    <DashboardPage
      title="Referências visuais"
      description={`${client.name} · inspirações para o Brand DNA`}
    >
      <div className={layout.sectionGap}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Surface variant="elevated">
              <SurfaceHeader>
                <SurfaceTitle>Upload de referências</SurfaceTitle>
                <SurfaceDescription>
                  Envie imagens de referência do Behance ou outras fontes.
                  Usadas como contexto na geração do Creative Brain.
                </SurfaceDescription>
              </SurfaceHeader>
              <SurfaceContent>
                <ReferenceUpload clientId={id} />
              </SurfaceContent>
            </Surface>

            <Surface>
              <SurfaceHeader>
                <SurfaceTitle>Referências ({references.length})</SurfaceTitle>
              </SurfaceHeader>
              <SurfaceContent>
                <ReferenceGallery clientId={id} references={references} />
              </SurfaceContent>
            </Surface>
          </div>

          <Surface>
            <SurfaceHeader>
              <SurfaceTitle>Fotos do cliente ({clientPhotos.length}/5)</SurfaceTitle>
              <SurfaceDescription>
                Fotos do cliente, produto ou espaço. Copie as URLs para usar no Spaces.
              </SurfaceDescription>
            </SurfaceHeader>
            <SurfaceContent>
              <ClientPhotosPanel
                clientId={id}
                clientName={client.name}
                photos={clientPhotos}
              />
            </SurfaceContent>
          </Surface>
        </div>

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
    </DashboardPage>
  );
}
