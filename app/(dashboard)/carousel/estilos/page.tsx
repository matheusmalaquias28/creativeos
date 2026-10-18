import { DashboardPage } from "@/components/layout/dashboard-page";
import { StylesList } from "@/components/carousel-styles/styles-list";
import { listCarouselStyles } from "@/services/carousel-styles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Estilos de carrossel",
};

export default async function CarouselStylesPage() {
  const styles = await listCarouselStyles();

  return (
    <DashboardPage
      title="Estilos de carrossel"
      description="Acervo de estilos: suba as artes de um carrossel de exemplo e a IA aplica a mesma identidade nos próximos"
    >
      <StylesList initialStyles={styles} />
    </DashboardPage>
  );
}
