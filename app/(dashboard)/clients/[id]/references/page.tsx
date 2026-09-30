import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getClientVisualIdentity } from "@/services/visual-identity";
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

  const [references, clientPhotos, bankAssets, readiness, identity] = await Promise.all([
    getClientReferences(id),
    getClientPhotos(id),
    getReferenceAssets(id),
    getClientArtReadiness(id),
    getClientVisualIdentity(id),
  ]);

  return (
    <DashboardPage
      title="Referências visuais"
      description="Materiais opcionais. As imagens do onboarding e desta página ficam disponíveis na geração das demandas; você não precisa reenviá-las."
      backHref={`/clients/${id}`}
      backLabel={client.name}
    >
      <div className={layout.sectionGap}>
        {identity.identitySampleUrls.length > 0 && <section className="space-y-3">
          <SectionHeader title="Identidade cadastrada no onboarding" description="Já disponível para a IA. Não precisa fazer outro upload." icon={ImageIcon} tone="cyan" />
          <div className="flex flex-wrap gap-3">{identity.identitySampleUrls.map((url) => <div key={url} className="relative size-24 overflow-hidden rounded-lg"><Image src={url} alt="Referência de identidade do cliente" fill unoptimized className="object-cover" sizes="96px" /></div>)}</div>
          <Link href={"/clients/" + id + "/onboarding"} className="text-sm underline">Editar identidade e liberdade visual</Link>
        </section>}
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
              title="Outras inspirações (opcional)"
              description="Também disponíveis para a geração de demandas. Não é obrigatório preencher este acervo."
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
