import { notFound } from "next/navigation";
import { allCards } from "@/features/album/collections";
import { CardDetail } from "@/features/album/CardDetail";

// Export statique : seules les cartes du contenu existent comme pages.
export const dynamicParams = false;

export function generateStaticParams() {
  return allCards.map((card) => ({ card: card.id }));
}

export default async function AlbumCardPage({ params }: { params: Promise<{ card: string }> }) {
  const { card } = await params;
  if (!allCards.some((candidate) => candidate.id === card)) notFound();
  return <CardDetail cardId={card} />;
}
