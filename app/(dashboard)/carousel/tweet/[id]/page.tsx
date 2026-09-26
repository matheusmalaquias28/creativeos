import { notFound } from "next/navigation";
import { TweetCarouselEditor } from "@/components/carousel/tweet/tweet-carousel-editor";
import { getTweetCarouselById, getTweetProfilesForUser } from "@/services/tweet-carousels";

type PageProps = { params: Promise<{ id: string }> };

export default async function TweetCarouselPage({ params }: PageProps) {
  const { id } = await params;
  const [carousel, profiles] = await Promise.all([
    getTweetCarouselById(id),
    getTweetProfilesForUser(),
  ]);
  if (!carousel) notFound();

  return <TweetCarouselEditor carousel={carousel} profiles={profiles} />;
}
