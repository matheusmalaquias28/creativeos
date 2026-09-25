import { notFound } from "next/navigation";
import { Camera, ImageIcon, Library, Upload } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { SectionHeader } from "@/components/layout/section-header";
import { ReferenceUpload } from "@/components/clients/reference-upload";
import { ReferenceGallery } from "@/components/clients/reference-gallery";
import { ClientPhotosPanel } from "@/components/clients/client-photos-panel";
import { ReferenceBank } from "@/components/art-director/reference-bank";
import { ReadinessChips } from "@/components/art-director/readiness-chips";
import { Surface } from "@/components/ui/surface";
import { layout } from "@/lib/design/tokens";
import { getAuthUser } from "@/lib/auth/session";
import { getClientById, getClientReferences } from "@/services/clients";
import { getClientPhotos } from "@/services/client-photos";
import { getClientArtReadiness, getReferenceAssets } from "@/services/reference-assets";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReferencesPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return null;

  const client = await getClientById(id, user.id);
  if (!client) notFound();

  const [references, clientPhotos, bankAssets, readiness] = await Promise.all([
    getClientReferences(id),
    getClientPhotos(id),
    getReferenceAssets(id),
    getClientArtReadiness(id),
  ]);

  return (
    <DashboardPage
      title="Referências visuais"
      description="Inspirações, acervo anotado por IA e fotos do cliente usados no Brand DNA e na geração de artes."
      backHref={`/clients/${id}`}
      backLabel={client.name}
    >
      <div className={layout.sectionGap}>
        <section className="space-y-4">
          <SectionHeader
            title={`Acervo para geração com IA (${bankAssets.length})`}
            description="Cada imagem é anotada por IA no upload — confira se a descrição bate com o que a imagem tem de reaproveitável."
            icon={Library}
            tone="violet"
            action={<ReadinessChips readiness={readiness} />}
          />
          <Surface padding="md">
            <ReferenceBank clientId={id} assets={bankAssets} />
          </Surface>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-4">
            <SectionHeader
              title="Upload de referências"
              description="Imagens do Behance ou outras fontes, usadas na geração do Creative Brain."
              icon={Upload}
              tone="cyan"
            />
            <Surface padding="md" className="space-y-6">
              <ReferenceUpload clientId={id} />
              <div className="space-y-3 border-t border-border pt-5">
                <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-muted-foreground">
                  <ImageIcon className="size-3.5" strokeWidth={2} />
                  Referências enviadas
                  <span className="rounded-md bg-muted px-1.5 text-[0.6875rem] tabular-nums">
                    {references.length}
                  </span>
                </p>
                <ReferenceGallery clientId={id} references={references} />
              </div>
            </Surface>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title={`Fotos do cliente (${clientPhotos.length}/5)`}
              description="Produto, espaço ou contexto. Copie para usar no Spaces."
              icon={Camera}
              tone="orange"
            />
            <Surface padding="md">
              <ClientPhotosPanel
                clientId={id}
                clientName={client.name}
                photos={clientPhotos}
              />
            </Surface>
          </section>
        </div>
      </div>
    </DashboardPage>
  );
}
