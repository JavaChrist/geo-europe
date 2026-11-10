"use client";

import { Play, RotateCcw, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import content from "@country";
import { isRunOver, isRunResumable, type LevelRun, nextChallenge, startRun, submitAnswer } from "@/engine/level-run";
import { drawNational, isBankPlayable, type NationalBadge, type NationalBank, newNationalBadges } from "@/engine/national-challenges";
import { type ChallengeFormat, type ChallengeRecord, correctCount, isBetterPerformance } from "@/engine/special-challenges";
import { ChallengeView } from "@/features/journey/ChallengeView";
import { SpecialChallengeResult } from "@/features/journey/SpecialChallengeResult";
import { useChallengeRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import { readQuestionHistory, recordChallengeResult } from "@/services/local-progress";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, primaryButton, secondaryButton } from "@/ui/styles";
import { NATIONAL_BADGES } from "./national-content";
import { useNationalRun } from "./useNationalRun";

interface Outcome {
  run: LevelRun;
  improved: boolean;
  newBadgeName: string | null;
  record: ChallengeRecord | null;
}

interface NationalChallengeGameProps {
  /** Clé du résultat et de l'historique des questions. */
  challengeKey: string;
  rules: ChallengeFormat;
  bank: NationalBank;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  description: string;
  /** Première règle : ce que contient la partie. */
  questionsRule: string;
  /** Badge que ce défi fait gagner, `null` pour la version Découverte. */
  badge: NationalBadge | null;
  /** Texte montré avant les règles, comme l'avertissement de la Découverte. */
  notice?: ReactNode;
  /** Texte montré quand la banque ne permet pas de composer une partie. */
  unavailable: string;
  backHref: string;
  backLabel: string;
}

/** Déroulé du Défi de France et des Défis thématiques : les règles du Défi Maître, sans territoire. */
export function NationalChallengeGame({
  challengeKey,
  rules,
  bank,
  title,
  subtitle,
  icon: Icon,
  description,
  questionsRule,
  badge,
  notice,
  unavailable,
  backHref,
  backLabel,
}: NationalChallengeGameProps) {
  const { t, tContent } = useTranslation();
  const modal = useModal();
  const challenges = useChallengeRecords();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { run, setRun, paused, promotion, quit, clearPaused } = useNationalRun(`challenge:${challengeKey}`, backHref);

  const playable = isBankPlayable(bank, rules);
  const resumableRun = !run && !outcome && playable && paused && isRunResumable(paused, bank) ? paused : null;
  const record = challenges[challengeKey];

  const start = () => {
    setOutcome(null);
    const history = readQuestionHistory(content.country.code, challengeKey);
    setRun(startRun(bank, drawNational(bank, rules, history, Math.random), Math.random, rules));
  };

  const finish = (finished: LevelRun) => {
    // Avant l'enregistrement : une partie terminée ne peut plus être reprise, ses gains ne se comptent qu'une fois.
    clearPaused();
    const performance = { correct: correctCount(finished.results), timeMs: null };
    let saved: ChallengeRecord | null = null;
    try {
      saved = recordChallengeResult(content.country.code, challengeKey, rules, performance, finished.results);
    } catch (error) {
      void modal.error(error);
    }
    // Seulement au premier gain : un rejeu ne fait rien gagner de nouveau. La version Découverte n'a pas de badge.
    const earned = saved && badge ? newNationalBadges(NATIONAL_BADGES, challenges, { ...challenges, [challengeKey]: saved }).filter((candidate) => candidate.id === badge.id) : [];
    for (const won of earned) {
      void modal.reward({
        titleKey: "album.reward.badgeTitle",
        bodyKey: "album.reward.badgeBody",
        values: { name: tContent(won.nameKey), description: tContent(won.descriptionKey) },
      });
    }
    setOutcome({
      run: finished,
      improved: !record || isBetterPerformance(performance, { correct: record.bestCorrect, timeMs: null }),
      newBadgeName: earned[0] ? tContent(earned[0].nameKey) : null,
      record: saved,
    });
    setRun(null);
    promotion.gameCompleted();
  };

  const answer = (answerId: string) => {
    if (run) setRun(submitAnswer(run, bank, answerId));
  };

  const next = () => {
    if (!run) return;
    if (isRunOver(run)) finish(run);
    else setRun(nextChallenge(run, bank, Math.random));
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      {promotion.overlay}
      {run ? (
        <h1 className="text-sm text-ink-soft">{title}</h1>
      ) : (
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            <Icon aria-hidden className="size-7 shrink-0 text-gold" />
            {title}
          </h1>
          {subtitle && <p className="text-sm text-sky">{subtitle}</p>}
        </div>
      )}

      {run && (
        <ChallengeView key={run.index} level={bank} run={run} special={{ timed: false }} onAnswer={answer} onNext={next} onQuit={quit} />
      )}

      {outcome && (
        <SpecialChallengeResult
          rules={rules}
          bank={bank}
          challengeIds={outcome.run.challengeIds}
          results={outcome.run.results}
          timeMs={null}
          expired={false}
          improved={outcome.improved}
          newBadgeName={outcome.newBadgeName}
          keptBadgeName={outcome.record?.passed && badge ? tContent(badge.nameKey) : null}
          record={outcome.record}
          onReplay={start}
          backHref={backHref}
          backLabel={backLabel}
          onBack={() => undefined}
        />
      )}

      {!run && !outcome && notice}

      {!run && !outcome && !playable && (
        <section className={card}>
          <p className="text-ink-soft">{unavailable}</p>
        </section>
      )}

      {resumableRun && (
        <section className={card}>
          <h2 className="font-display text-xl font-semibold">{t("journey.resume.title")}</h2>
          <p className="text-ink-soft">
            {t("journey.resume.bodySpecial", {
              current: resumableRun.index + 1,
              total: resumableRun.challengeIds.length,
              tally: t("journey.specials.game.tally", { count: correctCount(resumableRun.results) }),
            })}
          </p>
          <button type="button" onClick={() => setRun(resumableRun)} className={primaryButton}>
            <Play aria-hidden className="size-5" />
            {t("journey.resume.continue")}
          </button>
          <button type="button" onClick={start} className={secondaryButton}>
            <RotateCcw aria-hidden className="size-5" />
            {t("journey.resume.restart")}
          </button>
        </section>
      )}

      {!run && !outcome && !resumableRun && playable && (
        <section className={card}>
          <p className="text-ink-soft">{description}</p>
          <h2 className="font-display text-xl font-semibold">{t("journey.specials.rules.title")}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-soft">
            <li>{questionsRule}</li>
            <li>{t("journey.specials.rules.noLimit")}</li>
            <li>{t("journey.specials.rules.oneAttempt")}</li>
            {rules.passCorrect !== null && <li>{t("journey.specials.rules.pass", { count: rules.passCorrect })}</li>}
            {badge ? <li>{t("journey.specials.rules.badge", { name: tContent(badge.nameKey) })}</li> : <li>{t("challenges.national.rules.noBadge")}</li>}
            <li>{t("challenges.national.rules.noXp")}</li>
          </ul>
          <button type="button" onClick={start} className={primaryButton}>
            <Play aria-hidden className="size-5" />
            {t("journey.start")}
          </button>
        </section>
      )}

      {!run && !outcome && <BackLink href={backHref} label={backLabel} />}
    </main>
  );
}
