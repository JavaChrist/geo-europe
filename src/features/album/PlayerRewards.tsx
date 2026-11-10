"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { isBadgeEarned } from "@/engine/album";
import { isNationalBadgeEarned } from "@/engine/national-challenges";
import { useChallengeRecords, useLevelRecords } from "@/features/journey/useLevelRecords";
import { NATIONAL_BADGES } from "@/features/national/national-content";
import { useTranslation } from "@/i18n/I18nProvider";
import { BadgeEmblem } from "./BadgeEmblem";
import { collections } from "./collections";

/** Les badges gagnés sur cet appareil, tous territoires confondus. */
export function PlayerRewards() {
  const { t, tContent } = useTranslation();
  const records = useLevelRecords();
  const challenges = useChallengeRecords();
  const earned = [
    ...collections.flatMap((territory) => territory.badges.filter((badge) => isBadgeEarned(badge, territory.souvenirCards, records, challenges))),
    ...NATIONAL_BADGES.filter((badge) => isNationalBadgeEarned(badge, challenges)),
  ];

  return (
    <section className="flex w-full flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5 text-left">
      <h2 className="font-display text-xl font-semibold">{t("album.rewards.title")}</h2>
      {earned.length === 0 ? (
        <p className="text-ink-soft">{t("album.rewards.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {earned.map((badge) => (
            <li key={badge.id} className="flex items-start gap-3 rounded-2xl border border-gold bg-gold/10 p-3">
              <BadgeEmblem badge={badge} earned />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-ink-soft">{t(`album.badge.${badge.kind}`)}</span>
                <span className="font-semibold">{tContent(badge.nameKey)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/album"
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-1 font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <BookOpen aria-hidden className="size-5 shrink-0" />
        {t("album.rewards.open")}
      </Link>
    </section>
  );
}
