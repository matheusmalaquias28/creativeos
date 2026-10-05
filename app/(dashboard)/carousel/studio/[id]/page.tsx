import { notFound } from "next/navigation";
import { StudioEditor } from "@/components/carousel-studio/studio-editor";
import { getStudioCarousel } from "@/services/carousel-studio";
import { getDemandReferenceImages } from "@/services/art-gen";

export const maxDuration = 60;

type PageProps = { params: Promise<{ id: string }> };

export default async function CarouselStudioPage({ params }: PageProps) {
  const { id } = await params;
  const carousel = await getStudioCarousel(id);
  if (!carousel) notFound();

  const demandRefs = carousel.demand_id ? await getDemandReferenceImages(carousel.demand_id).catch(() => []) : [];

  return (
    <StudioEditor
      initial={carousel}
      demandReferenceUrls={demandRefs.map((r) => r.storage_url).filter(Boolean)}
      backHref={carousel.demand_id ? `/demands/${carousel.demand_id}` : "/carousel"}
      backLabel={carousel.demand_id ? "Demanda" : "Carrosséis"}
    />
  );
}
