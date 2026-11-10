"use client";

import { Info, Shapes } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import content from "@country";
import { accessibleTerritories, THEME_RULES, type ThemeAccess, themeBank, themeKey } from "@/engine/national-challenges";
import { CheckingAccess } from "@/features/account/RegionGate";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import { card, secondaryButton } from "@/ui/styles";
import { freeRegionNames, NATIONAL_BADGES, PUBLISHED_TERRITORIES } from "./national-content";
import { NationalChallengeGame } from "./NationalChallengeGame";

/**
 * Un défi thématique. Éditions payantes et Accès offert : le défi complet, qui donne le badge.
 * Découverte : le même défi avec les régions gratuites, gardé à part et sans badge, ce que l'écran dit avant de jouer.
 */
export function ThemeChallenge({ themeId }: { themeId: string }) {
  const { t, tContent, locale } = useTranslation();
  const { entitlements, status, canPlayRegion } = useEntitlements();
  const theme = content.family.themes.find((candidate) => candidate.id === themeId);
  const access: ThemeAccess = entitlements.fullGameAccess ? "full" : "discovery";
  const bank = useMemo(() => {
    if (!theme) return null;
    const territories = access === "full" ? PUBLISHED_TERRITORIES : accessibleTerritories(PUBLISHED_TERRITORIES, canPlayRegion);
    return themeBank(territories, theme, access);
  }, [theme, access, canPlayRegion]);

  if (!theme || !bank) return null;
  // Les droits décident de la banque : rien ne se tire avant de les connaître.
  if (access === "discovery" && status === "loading") return <CheckingAccess />;

  const badge = NATIONAL_BADGES.find((candidate) => candidate.themeId === theme.id) ?? null;
  const name = tContent(theme.nameKey);
  const notice =
    access === "discovery" ? (
      <section className={card}>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Info aria-hidden className="size-5 shrink-0 text-gold" />
          {t("challenges.national.themes.discoveryTitle")}
        </h2>
        <p className="text-ink-soft">
          {t("challenges.national.themes.discoveryBody", {
            regions: freeRegionNames(tContent, locale),
            badge: badge ? tContent(badge.nameKey) : name,
          })}
        </p>
        <Link href="/boutique" className={secondaryButton}>
          {t("challenges.national.themes.discoveryCta")}
        </Link>
      </section>
    ) : undefined;

  return (
    <NationalChallengeGame
      key={themeKey(theme.id, access)}
      challengeKey={themeKey(theme.id, access)}
      rules={THEME_RULES}
      bank={bank}
      title={name}
      subtitle={access === "discovery" ? t("challenges.national.status.discovery") : t("challenges.modes.themes.title")}
      icon={Shapes}
      description={t("challenges.national.themes.description", { theme: name })}
      questionsRule={t("challenges.national.themes.rules.questions", { count: THEME_RULES.questions })}
      badge={access === "full" ? badge : null}
      notice={notice}
      unavailable={t("challenges.national.themes.unavailable")}
      backHref="/defis/themes"
      backLabel={t("challenges.national.themes.backToThemes")}
    />
  );
}
