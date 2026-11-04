import { ChevronRight, Compass } from "lucide-react";
import Link from "next/link";
import type { Region } from "@/engine/types";
import { getTranslator } from "@/i18n/translator";
import { BackLink } from "@/ui/BackLink";
import { CoverPhoto } from "./CoverPhoto";
import { territoriesOf, territoryPath } from "./territories";

/** Entrée d'une région administrative vers ses parcours historiques et culturels. */
export function RegionJourneys({ region }: { region: Region }) {
  const { t, tContent } = getTranslator();
  const regionName = tContent(region.nameKey);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      {region.coverMediaId && (
        <div className="overflow-hidden rounded-3xl border border-gold/25 bg-surface/60 pb-3">
          <CoverPhoto mediaId={region.coverMediaId} />
        </div>
      )}

      <section className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold">{regionName}</h1>
        <p className="text-ink-soft">{t("journey.regionIntro")}</p>
      </section>

      <p className="rounded-2xl border border-sky/30 bg-abyss/30 p-4 text-sm text-ink-soft">
        {t("journey.regionNote", { region: regionName })}
      </p>

      <ul className="flex flex-col gap-3">
        {territoriesOf(region.id).map((territory) => (
          <li key={territory.id}>
            <Link
              href={territoryPath(region.slug, territory.slug)}
              className="fade-in flex items-center gap-4 rounded-3xl border border-gold/25 bg-surface/50 p-5 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
                <Compass aria-hidden className="size-6 text-gold" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-xl font-semibold">{tContent(territory.nameKey)}</span>
                <span className="text-sm text-ink-soft">
                  {tContent("country.subdivisionCount", { count: territory.subdivisionIds.length })}
                </span>
                <span className={`text-sm ${territory.status === "published" ? "text-gold" : "text-ink-soft"}`}>
                  {t(territory.status === "published" ? "explorer.statusPublished" : "explorer.statusDraft")}
                </span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" />
            </Link>
          </li>
        ))}
      </ul>

      <BackLink href="/explorer" label={t("explorer.backToMap")} />
    </main>
  );
}
