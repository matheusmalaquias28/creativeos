import { notFound } from "next/navigation";
import { CarouselEditor } from "@/components/carousel/carousel-editor";
import { getCarouselById } from "@/services/carousels";

// Editor pode levar tempo se carregar assets grandes
export const maxDuration = 60;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CarouselEditorPage({ params }: PageProps) {
  const { id } = await params;
  const carousel = await getCarouselById(id);

  if (!carousel) notFound();

  return <CarouselEditor initial={carousel} />;
}
