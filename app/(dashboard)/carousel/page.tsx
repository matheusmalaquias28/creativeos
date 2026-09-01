import { Layers } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { CarouselCard } from "@/components/carousel/carousel-card";
import { CreateCarouselDialog } from "@/components/carousel/create-carousel-dialog";
import { TurboButton, type TurboProfile } from "@/components/carousel/turbo/turbo-button";
import { Surface, SurfaceContent } from "@/components/ui/surface";
import { layout } from "@/lib/design/tokens";
import { getCarouselsForUser } from "@/services/carousels";
import { getCarouselProfilesForUser } from "@/services/carousel-profiles";
import { getClientOptionsForCurrentUser } from "@/services/clients";

export default async function CarouselPage() {
  const [carousels, profiles, clients] = await Promise.all([
    getCarouselsForUser(),
    getCarouselProfilesForUser(),
    getClientOptionsForCurrentUser(),
  ]);

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const turboProfiles: TurboProfile[] = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client_id ? clientMap.get(p.client_id) ?? null : null,
    colors: [p.color_background, p.color_title, p.color_subtitle, p.color_accent],
    hasContext: !!p.context_md?.trim(),
  }));

  return (
    <DashboardPage
      title="Carrosséis"
      description="Crie e gerencie carrosséis para o Instagram com IA"
      headerAction={
        <div className="flex items-center gap-2">
          <TurboButton profiles={turboProfiles} />
          <CreateCarouselDialog />
        </div>
      }
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
