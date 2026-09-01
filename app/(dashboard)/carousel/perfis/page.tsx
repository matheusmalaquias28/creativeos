import { DashboardPage } from "@/components/layout/dashboard-page";
import { ProfilesManager } from "@/components/carousel/profiles/profiles-manager";
import { layout } from "@/lib/design/tokens";
import { getCarouselProfilesForUser } from "@/services/carousel-profiles";
import { getClientOptionsForCurrentUser } from "@/services/clients";

export const metadata = {
  title: "Perfis de Design",
};

export default async function CarouselProfilesPage() {
  const [profiles, clients] = await Promise.all([
    getCarouselProfilesForUser(),
    getClientOptionsForCurrentUser(),
  ]);

  return (
    <DashboardPage
      title="Perfis de Design"
      description="Perfis pré-configurados de logo, fontes e cores por cliente para reaproveitar nos carrosséis"
    >
      <div className={layout.sectionGap}>
        <ProfilesManager initialProfiles={profiles} clients={clients} />
      </div>
    </DashboardPage>
  );
}
