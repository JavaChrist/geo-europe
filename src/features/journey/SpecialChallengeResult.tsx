"use client";

import { Award, BookOpen, Check, Minus, RotateCcw, Smartphone, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ChallengeResult, RunBank } from "@/engine/level-run";
import { type ChallengeRecord, correctCount, isChallengePassed, type SpecialChallengeRules } from "@/engine/special-challenges";
import { useTranslation } from "@/i18n/I18nProvider";
import { formatChallengeTime } from "./challenge-time";

interface SpecialChallengeResultProps {
  rules: SpecialChallengeRules;
  bank: RunBank;
  /** Toutes les questions de la partie, y compris celles que le temps n'a pas laissé jouer. */
  challengeIds: string[];
  results: ChallengeResult[];
  /** `null` pour un défi sans chronomètre. */
  timeMs: number | null;
  expired: boolean;
  improved: boolean;
  /** Nom du badge gagné par cette partie, `null` s'il n'y en a pas de nouveau. */
  newBadgeName: string | null;
  /** `null` : l'enregistrement a échoué, le joueur en a été prévenu. */
  record: ChallengeRecord | null;
  onReplay: () => void;
}

/** Résultat commun aux défis : seuls les éléments prévus par la configuration s'affichent. */
export function SpecialChallengeResult({ rules, bank, challengeIds, results, timeMs, expired, improved, newBadgeName, record, onReplay }: SpecialChallengeResultProps) {
  const { t, tContent } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const correct = correctCount(results);
  const passable = rules.passCorrect !== null;
  const passed = isChallengePassed(rules, correct);

  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const titleKey = passable
    ? passed
      ? "journey.specials.result.passed"
      : record?.passed
        ? "journey.specials.result.failedAgain"
        : "journey.specials.result.failed"
    : expired
      ? "journey.specials.result.expired"
      : "journey.specials.result.finished";

  return (
    <div className="fade-in flex flex-col gap-4">
      <section className="flex flex-col items-center gap-3 rounded-3xl border border-gold/25 bg-surface/60 px-5 py-8 text-center">
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          {t(titleKey)}
        </h2>
        <p className="text-xl font-semibold text-gold">{t("journey.specials.result.score", { count: correct, total: rules.questions })}</p>
        {passable && !passed && rules.passCorrect !== null && <p className="text-ink-soft">{t("journey.specials.result.need", { count: rules.passCorrect })}</p>}
        {passable && !passed && record?.passed && <p className="font-semibold">{t("journey.specials.result.kept")}</p>}
        {newBadgeName && (
          <p className="flex items-center gap-2 font-semibold">
            <Award aria-hidden className="size-5 shrink-0 text-gold" />
            {t("journey.specials.result.badge", { name: newBadgeName })}
          </p>
        )}
        {timeMs !== null && <p>{t("journey.specials.result.time", { time: formatChallengeTime(t, timeMs) })}</p>}
        {timeMs !== null && record && improved && correct > 0 && (
          <p className="flex items-center gap-2 font-semibold text-gold">
            <Trophy aria-hidden className="size-5 shrink-0" />
            {t("journey.specials.result.newRecord")}
          </p>
        )}
        {record && (
          <p className="text-sm">
            {record.bestTimeMs === null
              ? t("journey.specials.best", { count: record.bestCorrect, total: rules.questions })
              : t("journey.specials.bestTimed", { count: record.bestCorrect, total: rules.questions, time: formatChallengeTime(t, record.bestTimeMs) })}
          </p>
        )}
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

      {newBadgeName && (
        <Link
          href="/album"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/40 px-5 text-center font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <BookOpen aria-hidden className="size-5 shrink-0" />
          {t("journey.specials.result.openAlbum")}
        </Link>
      )}

      <section className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
        <h3 className="font-display text-xl font-semibold">{t("journey.specials.result.answers")}</h3>
        <ol className="flex flex-col gap-3">
          {challengeIds.map((id) => {
            const challenge = bank.questions.find((candidate) => candidate.id === id);
            if (!challenge) return null;
            const result = results.find((candidate) => candidate.challengeId === id);
            const answer = challenge.answers.find((candidate) => candidate.id === challenge.answerId);
            const Icon = !result ? Minus : result.correct ? Check : X;
            const tone = !result ? "text-ink-soft" : result.correct ? "text-success" : "text-danger";
            return (
              <li key={id} className="flex items-start gap-2 text-sm">
                <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${tone}`} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-ink-soft">{tContent(challenge.promptKey)}</span>
                  <span className="font-semibold">{answer ? tContent(answer.labelKey) : ""}</span>
                  {!result && <span className="text-xs text-ink-soft">{t("journey.specials.result.unanswered")}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
