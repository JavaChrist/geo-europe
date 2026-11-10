"use client";

import { Award, ChevronRight, Info, Shapes } from "lucide-react";
import Link from "next/link";
import content from "@country";
import { isNationalBadgeEarned } from "@/engine/national-challenges";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useChallengeRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import { BackLink } from "@/ui/BackLink";
import { card } from "@/ui/styles";
import { freeRegionNames, NATIONAL_BADGES } from "./national-content";

/** Les défis thématiques du pays, avec ce que la Découverte permet avant de choisir. */
export function ThemeChallenges() {
  const { t, tContent, locale } = useTranslation();
  const { entitlements, status } = useEntitlements();
  const challenges = useChallengeRecords();
  const discovery = status !== "loading" && !entitlements.fullGameAccess;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className={card}>
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Shapes aria-hidden className="size-7 shrink-0 text-gold" />
          {t("challenges.modes.themes.title")}
        </h1>
        <p className="text-ink-soft">{t("challenges.national.themes.intro")}</p>
      </section>

      {discovery && (
        <section className={card}>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Info aria-hidden className="size-5 shrink-0 text-gold" />
            {t("challenges.national.themes.discoveryTitle")}
          </h2>
          <p className="text-ink-soft">
            {t("challenges.national.themes.discoveryBody", {
              regions: freeRegionNames(tContent, locale),
              badge: t("album.badge.theme"),
            })}
          </p>
        </section>
      )}

      <ul className="flex flex-col gap-3">
        {content.family.themes.map((theme) => {
          const badge = NATIONAL_BADGES.find((candidate) => candidate.themeId === theme.id);
          const earned = badge ? isNationalBadgeEarned(badge, challenges) : false;
          return (
            <li key={theme.id}>
              <Link
                href={`/defis/themes/${theme.id}`}
                className="flex min-h-20 items-center gap-4 rounded-2xl border border-gold/25 bg-surface/60 p-4 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-display text-lg font-semibold">{tContent(theme.nameKey)}</span>
                  {badge && <span className="text-sm text-ink-soft">{tContent(badge.nameKey)}</span>}
                  {earned ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
                      <Award aria-hidden className="size-4 shrink-0" />
                      {t("challenges.status.badge")}
                    </span>
                  ) : (
                    discovery && <span className="text-sm text-ink-soft">{t("challenges.national.status.discovery")}</span>
                  )}
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" />
              </Link>
            </li>
          );
        })}
      </ul>

      <BackLink href="/defis" label={t("challenges.backToHub")} />
    </main>
  );
}
