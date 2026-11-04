import { notFound } from "next/navigation";
import { Suspense } from "react";
import content from "@country";
import { availableSpecialChallenges } from "@/engine/special-challenges";
import { SpecialChallengeGame } from "@/features/journey/SpecialChallengeGame";
import { findTerritory, regionSlugOf, territoryPath } from "@/features/journey/territories";
import { getTranslator } from "@/i18n/translator";

// Export statique : seuls les défis que la banque d'un territoire permet existent comme pages.
export const dynamicParams = false;

export function generateStaticParams() {
  return content.territories.flatMap((territory) =>
    availableSpecialChallenges(territory).map((rules) => ({ slug: regionSlugOf(territory), territory: territory.slug, defi: rules.slug })),
  );
}

export default async function SpecialChallengePage({ params }: { params: Promise<{ slug: string; territory: string; defi: string }> }) {
  const { slug, territory: territorySlug, defi } = await params;
  const found = findTerritory(slug, territorySlug);
  const rules = found && availableSpecialChallenges(found.territory).find((candidate) => candidate.slug === defi);
  if (!found || !rules) notFound();

  const { t, tContent } = getTranslator();
  return (
    // Le jeu lit son chemin d'accès dans l'adresse : en export statique, cette lecture exige une frontière Suspense.
    <Suspense>
      <SpecialChallengeGame
        territoryId={found.territory.id}
        kind={rules.kind}
        backHref={territoryPath(found.region.slug, found.territory.slug)}
        backLabel={t("journey.backTo", { name: tContent(found.territory.nameKey) })}
      />
    </Suspense>
  );
}
