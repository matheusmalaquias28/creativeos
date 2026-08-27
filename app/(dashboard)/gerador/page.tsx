import { DashboardPage } from "@/components/layout/dashboard-page";
import { ImageGenerator } from "@/components/gerador/image-generator";

export default function GeradorPage() {
  return (
    <DashboardPage
      title="Gerador"
      description="Gere imagens com o modelo Nano Banana Pro — texto para imagem de alta qualidade"
    >
      <ImageGenerator />
    </DashboardPage>
  );
}
