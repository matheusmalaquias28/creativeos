import { notFound } from "next/navigation";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { StyleEditor } from "@/components/carousel-styles/style-editor";
import { getCarouselStyle, getStyleTemplateSummary } from "@/services/carousel-styles";
import { getClientOptionsForCurrentUser } from "@/services/clients";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function CarouselStylePage({ params }: PageProps) {
  const { id } = await params;
  const [style, clients, template] = await Promise.all([
    getCarouselStyle(id),
    getClientOptionsForCurrentUser(),
    getStyleTemplateSummary(id),
  ]);
  if (!style || !style.active) notFound();

  return (
    <DashboardPage title={style.name} backHref="/carousel/estilos" backLabel="Estilos">
      <StyleEditor initialStyle={style} clients={clients} template={template} />
    </DashboardPage>
  );
}
