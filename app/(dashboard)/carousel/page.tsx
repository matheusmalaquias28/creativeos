import { Inbox, Layers } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { CarouselCard } from "@/components/carousel/carousel-card";
import { CreateCarouselDialog } from "@/components/carousel/create-carousel-dialog";
import { Surface, SurfaceContent } from "@/components/ui/surface";
import { layout } from "@/lib/design/tokens";
import { getCarouselsForUser } from "@/services/carousels";

export default async function CarouselPage() {
  const carousels = await getCarouselsForUser();

  return (
    <DashboardPage
      title="Carrosséis"
      description="Crie e gerencie carrosséis para o Instagram com IA"
      headerAction={<CreateCarouselDialog />}
    >
      <div className={layout.sectionGap}>
        {carousels.length === 0 ? (
          <Surface variant="dashed" padding="lg">
            <SurfaceContent className="flex flex-col items-center text-center">
              <Layers
                className="mb-4 size-8 text-muted-foreground/40"
                strokeWidth={1.25}
              />
              <p className="text-sm font-medium text-foreground">
                Nenhum carrossel ainda
              </p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Crie seu primeiro carrossel e use IA para gerar slides
                automaticamente a partir de um tema.
              </p>
              <div className="mt-4">
                <CreateCarouselDialog />
              </div>
            </SurfaceContent>
          </Surface>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {carousels.map((carousel) => (
              <CarouselCard key={carousel.id} carousel={carousel} />
            ))}
          </div>
        )}
      </div>
    </DashboardPage>
  );
}
