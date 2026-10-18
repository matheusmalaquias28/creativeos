import { notFound } from "next/navigation";
import { StudioEditor } from "@/components/carousel-studio/studio-editor";
import { getStudioCarousel } from "@/services/carousel-studio";
import { getDemandReferenceImages } from "@/services/art-gen";
import { listCarouselStyleOptions } from "@/services/carousel-styles";

export const maxDuration = 60;

type PageProps = { params: Promise<{ id: string }> };

export default async function CarouselStudioPage({ params }: PageProps) {
  const { id } = await params;
  const carousel = await getStudioCarousel(id);
  if (!carousel) notFound();

  const [demandRefs, styles] = await Promise.all([
    carousel.demand_id ? getDemandReferenceImages(carousel.demand_id).catch(() => []) : Promise.resolve([]),
    listCarouselStyleOptions().catch(() => []),
  ]);

  return (
    <StudioEditor
      initial={carousel}
      demandReferenceUrls={demandRefs.map((r) => r.storage_url).filter(Boolean)}
      styles={styles}
      backHref={
        carousel.style_template_for
          ? `/carousel/estilos/${carousel.style_template_for}`
          : carousel.demand_id
            ? `/demands/${carousel.demand_id}`
            : "/carousel"
      }
      backLabel={carousel.style_template_for ? "Estilo" : carousel.demand_id ? "Demanda" : "Carrosséis"}
    />
  );
}
