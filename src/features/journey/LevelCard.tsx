"use client";

import { ChevronRight, Lock, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { starsFor } from "@/engine/level-run";
import { isLevelUnlocked, type LevelSummary, UNLOCK_RULES } from "@/engine/level-unlock";
import { useTranslation } from "@/i18n/I18nProvider";
import { StarRating } from "./StarRating";
import { useLevelRecords } from "./useLevelRecords";

interface LevelCardProps {
  level: LevelSummary;
  /** Niveau à réussir avant celui-ci, `null` pour le premier du parcours. */
  previous: LevelSummary | null;
  href: string;
}

/** Niveau d'un territoire, avec les résultats réellement enregistrés sur cet appareil. */
export function LevelCard({ level, previous, href }: LevelCardProps) {
  const { t, tContent } = useTranslation();
  const records = useLevelRecords();
  const record = records[level.id];
  const Icon = record ? RotateCcw : Play;

  if (!isLevelUnlocked(previous, records)) {
    return (
      <div className="flex flex-col gap-3 rounded-3xl border border-gold/10 bg-surface/30 p-5">
        <span className="font-display text-xl font-semibold text-ink-soft">{tContent(level.nameKey)}</span>
        <span className="text-ink-soft">{tContent(level.descriptionKey)}</span>
        <span className="flex items-start gap-2 text-sm font-semibold">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
          {previous && t("journey.locked.hint", { count: UNLOCK_RULES.stars, level: tContent(previous.nameKey) })}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <span className="font-display text-xl font-semibold">{tContent(level.nameKey)}</span>
      <span className="text-ink-soft">{tContent(level.descriptionKey)}</span>
      {record ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <StarRating count={starsFor(record.bestScore, level.stars)} />
          <span>{t("journey.bestScore", { score: record.bestScore, max: level.maxScore })}</span>
          <span className="text-ink-soft">{t("journey.plays", { count: record.plays })}</span>
        </span>
      ) : (
        <span className="text-sm text-ink-soft">{t("journey.notPlayed")}</span>
      )}
      <span className="flex items-center gap-2 font-semibold text-gold">
        <Icon aria-hidden className="size-5" />
        {t(record ? "journey.replay" : "journey.play")}
        <ChevronRight aria-hidden className="ml-auto size-5" />
      </span>
    </Link>
  );
}
