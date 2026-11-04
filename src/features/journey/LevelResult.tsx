"use client";

import { Check, RotateCcw, Smartphone, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { maxScoreOf, type ChallengeResult, type StarCount } from "@/engine/level-run";
import type { Level } from "@/engine/types";
import { useTranslation } from "@/i18n/I18nProvider";
import type { LevelRecord } from "@/services/local-progress";
import { StarRating } from "./StarRating";

interface LevelResultProps {
  level: Level;
  results: ChallengeResult[];
  score: number;
  stars: StarCount;
  /** `null` : l'enregistrement a échoué, le joueur en a été prévenu. */
  record: LevelRecord | null;
  onReplay: () => void;
}

export function LevelResult({ level, results, score, stars, record, onReplay }: LevelResultProps) {
  const { t, tContent } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const max = maxScoreOf(level);

  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="fade-in flex flex-col gap-4">
      <section className="flex flex-col items-center gap-3 rounded-3xl border border-gold/25 bg-surface/60 px-5 py-8 text-center">
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          {t("journey.result.title")}
        </h2>
        <StarRating count={stars} large />
        <p className="text-xl font-semibold text-gold">{t("journey.result.score", { count: score, max })}</p>
        <p className="text-ink-soft">
          {stars === 0 ? t("journey.result.noStar", { one: level.stars.one }) : t("journey.result.stars", { count: stars })}
        </p>
        {record && <p className="text-sm">{t("journey.result.best", { score: record.bestScore, max })}</p>}
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Smartphone aria-hidden className="size-4 shrink-0" />
          {t(record ? "journey.deviceOnly" : "journey.result.notSaved")}
        </p>
      </section>

      <button
        type="button"
        onClick={onReplay}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-abyss transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <RotateCcw aria-hidden className="size-5" />
        {t("journey.replay")}
      </button>

      <section className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
        <h3 className="font-display text-xl font-semibold">{t("journey.result.detail")}</h3>
        <ol className="flex flex-col gap-2">
          {results.map((result) => {
            const challenge = level.challenges.find((candidate) => candidate.id === result.challengeId);
            const Icon = result.correct ? Check : X;
            return (
              <li key={result.challengeId} className="flex items-start gap-2 text-sm">
                <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${result.correct ? "text-success" : "text-danger"}`} />
                <span className="min-w-0 flex-1 text-ink-soft">{challenge ? tContent(challenge.promptKey) : ""}</span>
                <span className="shrink-0 font-semibold">{t("journey.game.score", { count: result.points })}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
