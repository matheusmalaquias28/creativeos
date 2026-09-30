import { DashboardPage } from "@/components/layout/dashboard-page";
import { LibraryManager } from "@/components/image-library/library-manager";
import { listLibraryImages } from "@/services/image-library";

export const dynamic = "force-dynamic";

export default async function AcervoPage() {
  const images = await listLibraryImages();

  return (
    <DashboardPage
      title="Acervo"
      description="Imagens próprias para usar nas artes: escolha em cada arte da demanda e diga como usar"
    >
      <LibraryManager initialImages={images} />
    </DashboardPage>
  );
}
