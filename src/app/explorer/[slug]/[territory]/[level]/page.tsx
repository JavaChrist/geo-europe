import { notFound } from "next/navigation";
import content from "@country";
import { LevelGame } from "@/features/journey/LevelGame";
import { findTerritory, regionSlugOf, territoryPath } from "@/features/journey/territories";
import { getTranslator } from "@/i18n/translator";

// Export statique : seuls les niveaux du contenu existent comme pages.
export const dynamicParams = false;

export function generateStaticParams() {
  return content.territories.flatMap((territory) =>
    territory.levels.map((level) => ({ slug: regionSlugOf(territory), territory: territory.slug, level: level.slug })),
  );
}

export default async function LevelPage({ params }: { params: Promise<{ slug: string; territory: string; level: string }> }) {
  const { slug, territory: territorySlug, level: levelSlug } = await params;
  const found = findTerritory(slug, territorySlug);
  const level = found?.territory.levels.find((candidate) => candidate.slug === levelSlug);
  if (!found || !level) notFound();

  const { t, tContent } = getTranslator();

  return (
    <LevelGame
      level={level}
      backHref={territoryPath(found.region.slug, found.territory.slug)}
      backLabel={t("journey.backTo", { name: tContent(found.territory.nameKey) })}
    />
  );
}
