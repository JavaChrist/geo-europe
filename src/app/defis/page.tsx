import { ChevronRight, Swords } from "lucide-react";
import Link from "next/link";
import content from "@country";
import { availableSpecialChallenges } from "@/engine/special-challenges";
import { SpecialChallenges } from "@/features/journey/SpecialChallenges";
import { regionSlugOf, territoryPath } from "@/features/journey/territories";
import { getTranslator } from "@/i18n/translator";
import { BackLink } from "@/ui/BackLink";

export default function ChallengesPage() {
  const { t, tContent } = getTranslator();
  const territories = content.territories.filter((territory) => territory.levels.length > 0 && availableSpecialChallenges(territory).length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/60 p-5">
        <span className="flex size-12 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
          <Swords aria-hidden className="size-6 text-gold" />
        </span>
        <h1 className="font-display text-3xl font-semibold">{t("challenges.title")}</h1>
        <p className="text-ink-soft">{t("challenges.intro")}</p>
      </section>

      {territories.length === 0 && <p className="rounded-3xl border border-gold/25 bg-surface/50 p-5 text-ink-soft">{t("challenges.empty")}</p>}

      {territories.map((territory) => {
        const path = territoryPath(regionSlugOf(territory), territory.slug);
        const name = tContent(territory.nameKey);
        return (
          <div key={territory.id} className="flex flex-col gap-3">
            <SpecialChallenges
              territoryId={territory.id}
              levelIds={territory.levels.map((level) => level.id)}
              challenges={availableSpecialChallenges(territory)}
              basePath={`${path}/defis`}
              title={name}
            />
            <Link
              href={path}
              className="inline-flex min-h-11 items-center gap-1 self-start rounded-xl px-1 font-semibold text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {t("challenges.openTerritory", { name })}
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          </div>
        );
      })}

      <BackLink href="/" label={t("common.backHome")} />
    </main>
  );
}
