"use client";

import { CalendarDays, ChevronRight, Flag, Shapes, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { dailyStreak, dayOf, isNationalBadgeEarned } from "@/engine/national-challenges";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useChallengeRecords, useDailyRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import { NATIONAL_BADGES } from "./national-content";

const noop = () => () => undefined;

function ModeLink({ href, icon: Icon, title, note, status }: { href: string; icon: LucideIcon; title: string; note: string; status: string | null }) {
  return (
    <Link
      href={href}
      className="flex min-h-20 items-center gap-4 rounded-2xl border border-gold/25 bg-surface/60 p-4 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
        <Icon aria-hidden className="size-6 text-gold" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-lg font-semibold">{title}</span>
        <span className="text-sm text-ink-soft">{note}</span>
        {status && <span className="text-sm font-semibold text-gold">{status}</span>}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" />
    </Link>
  );
}

/** Les trois défis nationaux, avec l'état du joueur lu sur l'appareil. */
export function NationalModeLinks() {
  const { t, tContent } = useTranslation();
  const { entitlements, status } = useEntitlements();
  const daily = useDailyRecords();
  const challenges = useChallengeRecords();
  const today = useSyncExternalStore(noop, () => dayOf(new Date()), () => null);

  const streak = today ? dailyStreak(daily, today) : null;
  const dailyStatus = today
    ? [daily[today] ? t("challenges.national.status.dailyDone") : t("challenges.national.status.dailyTodo"), streak && streak.current > 0 ? t("challenges.national.status.streak", { count: streak.current }) : null]
        .filter(Boolean)
        .join(" · ")
    : null;

  const france = NATIONAL_BADGES.find((badge) => badge.kind === "country");
  const themes = NATIONAL_BADGES.filter((badge) => badge.kind === "theme");
  const franceStatus =
    france && isNationalBadgeEarned(france, challenges)
      ? t("challenges.status.badge")
      : status !== "loading" && !entitlements.fullGameAccess
        ? t("challenges.national.status.countryLocked")
        : null;
  const themesEarned = themes.filter((badge) => isNationalBadgeEarned(badge, challenges)).length;

  return (
    <>
      <ModeLink href="/defis/jour" icon={CalendarDays} title={t("challenges.modes.daily.title")} note={t("challenges.modes.daily.note")} status={dailyStatus} />
      <ModeLink href="/defis/france" icon={Flag} title={tContent("country.challengeTitle")} note={t("challenges.modes.country.note")} status={franceStatus} />
      <ModeLink
        href="/defis/themes"
        icon={Shapes}
        title={t("challenges.modes.themes.title")}
        note={t("challenges.modes.themes.note")}
        status={t("challenges.national.status.themes", { count: themesEarned, total: themes.length })}
      />
    </>
  );
}
