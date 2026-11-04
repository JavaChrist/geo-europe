import { Building2, Castle, Compass, type LucideIcon, TreePine } from "lucide-react";
import { notFound } from "next/navigation";
import content from "@country";
import { previousSummary, summarizeLevel } from "@/engine/level-unlock";
import type { TerritoryPlace } from "@/engine/types";
import { CoverPhoto } from "@/features/journey/CoverPhoto";
import { LevelCard } from "@/features/journey/LevelCard";
import { TerritoryProgress } from "@/features/journey/ProgressPanels";
import { findTerritory, regionSlugOf, territoryPath } from "@/features/journey/territories";
import { getTranslator } from "@/i18n/translator";
import { BackLink } from "@/ui/BackLink";

// Export statique : seuls les territoires du contenu existent comme pages.
export const dynamicParams = false;

export function generateStaticParams() {
  return content.territories.map((territory) => ({ slug: regionSlugOf(territory), territory: territory.slug }));
}

const PLACE_ICONS: Record<TerritoryPlace["kind"], LucideIcon> = { city: Building2, monument: Castle, village: TreePine };

export default async function TerritoryPage({ params }: { params: Promise<{ slug: string; territory: string }> }) {
  const { slug, territory: territorySlug } = await params;
  const found = findTerritory(slug, territorySlug);
  if (!found) notFound();

  const { region, territory } = found;
  const { t, tContent } = getTranslator();
  const regionName = tContent(region.nameKey);
  const subdivisions = territory.subdivisionIds.flatMap((id) => region.subdivisions.filter((candidate) => candidate.id === id));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-3 overflow-hidden rounded-3xl border border-gold/25 bg-surface/60">
        {territory.coverMediaId && <CoverPhoto mediaId={territory.coverMediaId} />}
        <div className={`flex flex-col gap-3 px-5 pb-5 ${territory.coverMediaId ? "" : "pt-5"}`}>
          <span className="flex size-12 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
            <Compass aria-hidden className="size-6 text-gold" />
          </span>
          <h1 className="font-display text-3xl font-semibold">{tContent(territory.nameKey)}</h1>
          <p className="text-ink-soft">{tContent(territory.descriptionKey)}</p>
          <p className="text-sm text-sky">{t("journey.territoryNote", { region: regionName })}</p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">{tContent("country.subdivisionsTitle")}</h2>
        <ul className="flex flex-wrap gap-2">
          {subdivisions.map((subdivision) => (
            <li key={subdivision.id} className="flex items-center gap-2 rounded-full border border-gold/30 bg-abyss/30 px-3 py-1.5 text-sm">
              <span className="font-semibold text-gold">{subdivision.id}</span>
              {tContent(subdivision.nameKey)}
            </li>
          ))}
        </ul>
      </section>

      {territory.places.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-semibold">{t("journey.placesTitle")}</h2>
          <ul className="flex flex-wrap gap-2">
            {territory.places.map((place) => {
              const Icon = PLACE_ICONS[place.kind];
              return (
                <li key={place.id} className="flex items-center gap-2 rounded-full border border-gold/15 bg-abyss/30 px-3 py-1.5 text-sm">
                  <Icon aria-hidden className="size-4 text-gold" />
                  {tContent(place.nameKey)}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">{t("journey.levelsTitle")}</h2>
        {territory.levels.length === 0 ? (
          <p className="rounded-3xl border border-gold/25 bg-surface/50 p-5 text-ink-soft">{t("journey.inPreparation")}</p>
        ) : (
          <>
            <TerritoryProgress levels={territory.levels.map(summarizeLevel)} />
            {territory.levels.map((level, index) => (
              <LevelCard
                key={level.id}
                level={summarizeLevel(level)}
                previous={previousSummary(territory.levels, index)}
                href={`${territoryPath(region.slug, territory.slug)}/${level.slug}`}
              />
            ))}
            <p className="text-sm text-ink-soft">{t("journey.deviceOnly")}</p>
          </>
        )}
      </section>

      <BackLink href={`/explorer/${region.slug}`} label={t("journey.backTo", { name: regionName })} />
    </main>
  );
}
