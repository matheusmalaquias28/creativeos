import { notFound } from "next/navigation";
import { CarouselEditor } from "@/components/carousel/carousel-editor";
import { getCarouselById } from "@/services/carousels";

// Editor pode levar tempo se carregar assets grandes
export const maxDuration = 60;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ turbo?: string; imgs?: string }>;
};

export default async function CarouselEditorPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { turbo, imgs } = await searchParams;
  const carousel = await getCarouselById(id);

  if (!carousel) notFound();

  return (
    <CarouselEditor
      initial={carousel}
      turboGenerating={turbo === "1"}
      turboExpectedImages={imgs ? Number(imgs) : undefined}
    />
  );
}
