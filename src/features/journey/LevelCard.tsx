"use client";

import { ChevronRight, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { Level } from "@/engine/types";
import { maxScoreOf, starsFor } from "@/engine/level-run";
import { useTranslation } from "@/i18n/I18nProvider";
import { StarRating } from "./StarRating";
import { useLevelRecords } from "./useLevelRecords";

/** Niveau d'un territoire, avec les résultats réellement enregistrés sur cet appareil. */
export function LevelCard({ level, href }: { level: Level; href: string }) {
  const { t, tContent } = useTranslation();
  const record = useLevelRecords()[level.id];
  const Icon = record ? RotateCcw : Play;

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
          <span>{t("journey.bestScore", { score: record.bestScore, max: maxScoreOf(level) })}</span>
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
