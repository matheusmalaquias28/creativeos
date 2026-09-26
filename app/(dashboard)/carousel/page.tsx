import Link from "next/link";
import { Layers, Palette } from "lucide-react";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { SectionHeader } from "@/components/layout/section-header";
import { CarouselCard } from "@/components/carousel/carousel-card";
import { CreateCarouselDialog } from "@/components/carousel/create-carousel-dialog";
import { TurboButton, type TurboProfile } from "@/components/carousel/turbo/turbo-button";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { layout } from "@/lib/design/tokens";
import { getCarouselsForUser } from "@/services/carousels";
import { getCarouselProfilesForUser } from "@/services/carousel-profiles";
import { getClientOptionsForCurrentUser } from "@/services/clients";
import { getTweetCarouselsForUser, getTweetProfilesForUser } from "@/services/tweet-carousels";
import { TweetCarouselCard } from "@/components/carousel/tweet/tweet-carousel-card";

export default async function CarouselPage() {
  const [carousels, profiles, clients, tweetCarousels, tweetProfiles] = await Promise.all([
    getCarouselsForUser(),
    getCarouselProfilesForUser(),
    getClientOptionsForCurrentUser(),
    getTweetCarouselsForUser(),
    getTweetProfilesForUser(),
  ]);

  // Avançados e tweet na mesma grade, pela última edição.
  const items = [
    ...carousels.map((c) => ({ kind: "advanced" as const, updated_at: c.updated_at, carousel: c })),
    ...tweetCarousels.map((c) => ({ kind: "tweet" as const, updated_at: c.updated_at, carousel: c })),
  ].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

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
        <>
          <Link
            href="/carousel/perfis"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Palette />
            Perfis de design
          </Link>
          <TurboButton profiles={turboProfiles} tweetProfiles={tweetProfiles} />
          <CreateCarouselDialog />
        </>
      }
    >
      <div className={layout.sectionGap}>
        {items.length === 0 ? (
          <EmptyState
            icon={Layers}
            tone="pink"
            title="Nenhum carrossel ainda"
            description="Crie seu primeiro carrossel e use IA para gerar slides automaticamente a partir de um tema."
            action={<CreateCarouselDialog />}
          />
        ) : (
          <section className="space-y-4">
            <SectionHeader
              icon={Layers}
              tone="pink"
              title="Seus carrosséis"
              description={`${items.length} ${items.length === 1 ? "carrossel" : "carrosséis"} · ordenados pela última edição`}
            />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item) =>
                item.kind === "tweet" ? (
                  <TweetCarouselCard key={item.carousel.id} carousel={item.carousel} />
                ) : (
                  <CarouselCard key={item.carousel.id} carousel={item.carousel} />
                )
              )}
            </div>
          </section>
        )}
      </div>
    </DashboardPage>
  );
}
