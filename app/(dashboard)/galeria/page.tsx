import { createClient } from "@/lib/supabase/server";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import type { GeneratedImageRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function GaleriaPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generated_images")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(400);

  const images = (data ?? []) as GeneratedImageRow[];

  return (
    <DashboardPage
      title="Galeria"
      description="Todas as imagens geradas na plataforma, das mais recentes às mais antigas"
    >
      <GalleryGrid images={images} />
    </DashboardPage>
  );
}
