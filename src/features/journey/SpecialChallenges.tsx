"use client";

import { ChevronRight, Crown, Lock, type LucideIcon, Play, RotateCcw, Timer } from "lucide-react";
import Link from "next/link";
import {
  areSpecialChallengesUnlocked,
  challengeKey,
  type SpecialChallengeKind,
  type SpecialChallengeRules,
} from "@/engine/special-challenges";
import { useTranslation } from "@/i18n/I18nProvider";
import { formatChallengeTime } from "./challenge-time";
import { useChallengeRecords, useLevelRecords } from "./useLevelRecords";

export const SPECIAL_ICONS: Record<SpecialChallengeKind, LucideIcon> = { master: Crown, chrono: Timer };

interface SpecialChallengesProps {
  territoryId: string;
  levelIds: string[];
  challenges: SpecialChallengeRules[];
  basePath: string;
  /** Titre de la liste, par exemple le nom du territoire sur la page Défis. */
  title?: string;
}

/** Entrées de fin de parcours, déduites de la configuration commune des défis. */
export function SpecialChallenges({ territoryId, levelIds, challenges, basePath, title }: SpecialChallengesProps) {
  const { t } = useTranslation();
  const records = useLevelRecords();
  const results = useChallengeRecords();
  const unlocked = areSpecialChallengesUnlocked(levelIds, records);
  const done = levelIds.filter((id) => records[id] !== undefined).length;

  if (challenges.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold">{title ?? t("journey.specials.title")}</h2>
      {challenges.map((rules) => {
        const Icon = SPECIAL_ICONS[rules.kind];
        const name = t(`journey.specials.${rules.kind}.name`);
        const description = t(`journey.specials.${rules.kind}.description`);
        const optional = rules.passCorrect === null;

        if (!unlocked) {
          return (
            <div key={rules.kind} className="flex flex-col gap-3 rounded-3xl border border-gold/10 bg-surface/30 p-5">
              <span className="flex items-center gap-2 font-display text-xl font-semibold text-ink-soft">
                <Icon aria-hidden className="size-5 shrink-0" />
                {name}
              </span>
              <span className="text-ink-soft">{description}</span>
              <span className="flex items-start gap-2 text-sm font-semibold">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
                {t("journey.specials.locked", { count: levelIds.length })}
              </span>
              <span className="text-sm text-ink-soft">{t("journey.specials.levelsDone", { done, total: levelIds.length })}</span>
            </div>
          );
        }

        const record = results[challengeKey(territoryId, rules.kind)];
        const ReplayIcon = record ? RotateCcw : Play;
        return (
          <Link
            key={rules.kind}
            href={`${basePath}/${rules.slug}`}
            className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Icon aria-hidden className="size-5 shrink-0 text-gold" />
              <span className="font-display text-xl font-semibold">{name}</span>
              {optional && <span className="rounded-full border border-gold/30 px-2 py-0.5 text-xs text-ink-soft">{t("journey.specials.optional")}</span>}
            </span>
            <span className="text-ink-soft">{description}</span>
            {record ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span>
                  {record.bestTimeMs === null
                    ? t("journey.specials.best", { count: record.bestCorrect, total: rules.questions })
                    : t("journey.specials.bestTimed", { count: record.bestCorrect, total: rules.questions, time: formatChallengeTime(t, record.bestTimeMs) })}
                </span>
                {record.passed && <span className="font-semibold text-gold">{t("journey.specials.passed")}</span>}
                <span className="text-ink-soft">{t("journey.plays", { count: record.plays })}</span>
              </span>
            ) : (
              <span className="text-sm text-ink-soft">{t("journey.specials.notPlayed")}</span>
            )}
            <span className="flex items-center gap-2 font-semibold text-gold">
              <ReplayIcon aria-hidden className="size-5" />
              {t(record ? "journey.replay" : "journey.play")}
              <ChevronRight aria-hidden className="ml-auto size-5" />
            </span>
          </Link>
        );
      })}
    </section>
  );
}
