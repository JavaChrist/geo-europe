"use client";

import { Flag } from "lucide-react";
import { FRANCE_KEY, FRANCE_RULES, franceBank } from "@/engine/national-challenges";
import { CheckingAccess, LockCard } from "@/features/account/RegionGate";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import { NATIONAL_BADGES, PUBLISHED_TERRITORIES } from "./national-content";
import { NationalChallengeGame } from "./NationalChallengeGame";

const bank = franceBank(PUBLISHED_TERRITORIES);
const badge = NATIONAL_BADGES.find((candidate) => candidate.kind === "country") ?? null;

/** Défi de France : éditions payantes et Accès offert. La Découverte voit un verrou, sans partie. */
export function FranceChallenge() {
  const { t, tContent } = useTranslation();
  const { entitlements, status } = useEntitlements();
  const title = tContent("country.challengeTitle");

  if (!entitlements.fullGameAccess) {
    if (status === "loading") return <CheckingAccess />;
    return (
      <LockCard
        title={t("challenges.national.france.lockTitle", { name: title })}
        body={t("challenges.national.france.lockBody")}
        cta={t("lock.cta")}
        href="/boutique"
        back="/defis"
      />
    );
  }

  return (
    <NationalChallengeGame
      challengeKey={FRANCE_KEY}
      rules={FRANCE_RULES}
      bank={bank}
      title={title}
      icon={Flag}
      description={t("challenges.national.france.description")}
      questionsRule={t("challenges.national.france.rules.questions", { count: FRANCE_RULES.questions })}
      badge={badge}
      unavailable={t("challenges.national.france.unavailable")}
      backHref="/defis"
      backLabel={t("challenges.backToHub")}
    />
  );
}
