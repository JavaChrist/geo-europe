import { notFound } from "next/navigation";
import content from "@country";
import { findTerritory, regionSlugOf } from "@/features/journey/territories";
import { TerritoryJourney } from "@/features/journey/TerritoryJourney";

// Export statique : seuls les territoires du contenu existent comme pages.
export const dynamicParams = false;

export function generateStaticParams() {
  return content.territories.map((territory) => ({ slug: regionSlugOf(territory), territory: territory.slug }));
}

export default async function TerritoryPage({ params }: { params: Promise<{ slug: string; territory: string }> }) {
  const { slug, territory: territorySlug } = await params;
  const found = findTerritory(slug, territorySlug);
  if (!found) notFound();

  return <TerritoryJourney region={found.region} territory={found.territory} />;
}
