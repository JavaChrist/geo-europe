import { Building2, Castle, ChevronDown, Compass, type LucideIcon, TreePine } from "lucide-react";
import type { ReactNode } from "react";
import { previousSummary, summarizeLevel } from "@/engine/level-unlock";
import { availableSpecialChallenges } from "@/engine/special-challenges";
import type { Region, Territory, TerritoryPlace } from "@/engine/types";
import { CoverPhoto } from "@/features/journey/CoverPhoto";
import { LevelCard } from "@/features/journey/LevelCard";
import { TerritoryProgress } from "@/features/journey/ProgressPanels";
import { SpecialChallenges } from "@/features/journey/SpecialChallenges";
import { territoryPath } from "@/features/journey/territories";
import { getTranslator } from "@/i18n/translator";
import { BackLink } from "@/ui/BackLink";

const PLACE_ICONS: Record<TerritoryPlace["kind"], LucideIcon> = { city: Building2, monument: Castle, village: TreePine };

/** Liste repliée par défaut, ouverte au clic : choix définitif pour tous les parcours, sur tous les écrans. */
function FoldedList({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-gold/20 bg-surface/50">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          {title}
          <span className="rounded-full border border-gold/30 bg-abyss/40 px-2 py-0.5 font-sans text-sm font-semibold text-gold">{count}</span>
        </h2>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-gold transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/** Écran d'un parcours. Un territoire administratif est sa région : pas de mention de territoire culturel, retour à la carte. */
export function TerritoryJourney({ region, territory }: { region: Region; territory: Territory }) {
  const { t, tContent } = getTranslator();
  const regionName = tContent(region.nameKey);
  const administrative = territory.kind === "administrative";
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
          {!administrative && <p className="text-sm text-sky">{t("journey.territoryNote", { region: regionName })}</p>}
        </div>
      </section>

      <FoldedList title={tContent("country.subdivisionsTitle")} count={subdivisions.length}>
        <ul className="flex flex-wrap gap-2">
          {subdivisions.map((subdivision) => (
            <li key={subdivision.id} className="flex items-center gap-2 rounded-full border border-gold/30 bg-abyss/30 px-3 py-1.5 text-sm">
              <span className="font-semibold text-gold">{subdivision.id}</span>
              {tContent(subdivision.nameKey)}
            </li>
          ))}
        </ul>
      </FoldedList>

      {territory.places.length > 0 && (
        <FoldedList title={t("journey.placesTitle")} count={territory.places.length}>
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
        </FoldedList>
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

      <SpecialChallenges
        territoryId={territory.id}
        levelIds={territory.levels.map((level) => level.id)}
        challenges={availableSpecialChallenges(territory)}
        basePath={`${territoryPath(region.slug, territory.slug)}/defis`}
      />

      {administrative ? (
        <BackLink href="/explorer" label={t("explorer.backToMap")} />
      ) : (
        <BackLink href={`/explorer/${region.slug}`} label={t("journey.backTo", { name: regionName })} />
      )}
    </main>
  );
}
