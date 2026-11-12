"use client";

import { Lock, Play, RotateCcw } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import content from "@country";
import { newRewards, type NewRewards } from "@/engine/album";
import {
  applyJoker,
  isRunOver,
  isRunResumable,
  LEVEL_RULES,
  maxScoreOf,
  nextChallenge,
  scoreOf,
  starsFor,
  startRun,
  submitAnswer,
  type LevelRun,
  type StarCount,
} from "@/engine/level-run";
import { isLevelUnlocked, type LevelSummary, UNLOCK_RULES } from "@/engine/level-unlock";
import { questionsPerRunOf, selectQuestions } from "@/engine/question-selection";
import type { Level } from "@/engine/types";
import { usePromotion } from "@/features/promotions/usePromotion";
import { useHoldUpdate } from "@/features/update/update-hold";
import { useTranslation } from "@/i18n/I18nProvider";
import { type LevelRecord, readQuestionHistory, recordLevelResult } from "@/services/local-progress";
import { clearPausedRun, readPausedRun, savePausedRun, subscribeToPausedRuns } from "@/services/paused-runs";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { useLeaveGuard } from "@/ui/nav/leave-guard";
import { ChallengeView } from "./ChallengeView";
import { LevelResult } from "./LevelResult";
import { useLevelRecords } from "./useLevelRecords";

interface LevelGameProps {
  level: Level;
  /** Niveau à réussir avant celui-ci, `null` pour le premier du parcours. */
  previous: LevelSummary | null;
  backHref: string;
  backLabel: string;
}

const PRIMARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-abyss transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
const SECONDARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/40 px-5 font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

interface Outcome {
  run: LevelRun;
  score: number;
  stars: StarCount;
  record: LevelRecord | null;
}

/** Déroulé d'un niveau. Tout vient du contenu : ce composant ne connaît aucun territoire. */
export function LevelGame({ level, previous, backHref, backLabel }: LevelGameProps) {
  const { t, tContent } = useTranslation();
  const modal = useModal();
  const records = useLevelRecords();
  const unlocked = isLevelUnlocked(previous, records);
  // La partie démarre au clic : le tirage et l'ordre des réponses n'existent pas au rendu serveur.
  const [run, setRun] = useState<LevelRun | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  useHoldUpdate(run !== null);
  // Promotion possible seulement entre deux parties, après les modales de récompense.
  const promotion = usePromotion(run !== null);
  // Toute sortie (navigation, retour, bouton Quitter) passe par la même confirmation ; la partie reste gardée.
  const guard = useLeaveGuard(run !== null, { bodyKey: "journey.leave.body", backHref });

  // La partie est gardée à chaque étape : une sortie, l'arrière-plan ou un rechargement ne perdent rien.
  const runKey = `level:${level.id}`;
  const paused = useSyncExternalStore(
    subscribeToPausedRuns,
    () => readPausedRun(content.country.code, runKey),
    () => null,
  );
  const resumable = !run && unlocked && paused && isRunResumable(paused.run, level) ? paused.run : null;
  useEffect(() => {
    if (run) savePausedRun(content.country.code, runKey, { run, timer: null });
  }, [run, runKey]);

  const start = () => {
    setOutcome(null);
    const history = readQuestionHistory(content.country.code, level.id);
    setRun(startRun(level, selectQuestions(level, history, Math.random), Math.random));
  };

  const finish = (finished: LevelRun) => {
    // Avant l'enregistrement : une partie terminée ne peut plus être reprise, ses gains ne se comptent qu'une fois.
    clearPausedRun(content.country.code, runKey);
    const score = scoreOf(finished);
    const stars = starsFor(score, level.stars);
    let record: LevelRecord | null = null;
    try {
      record = recordLevelResult(content.country.code, level.id, score, stars, finished.results);
    } catch (error) {
      void modal.error(error);
    }
    setOutcome({ run: finished, score, stars, record });
    setRun(null);
    if (record) celebrate(newRewards(content.territories, records, { ...records, [level.id]: record }));
    promotion.gameCompleted();
  };

  // Seulement au premier gain : un rejeu ne fait rien gagner de nouveau.
  const celebrate = ({ cards, badges }: NewRewards) => {
    for (const card of cards) {
      void modal.reward({
        titleKey: "album.reward.cardTitle",
        bodyKey: "album.reward.cardBody",
        values: { name: tContent(card.nameKey) },
      });
    }
    for (const badge of badges) {
      void modal.reward({
        titleKey: "album.reward.badgeTitle",
        bodyKey: "album.reward.badgeBody",
        values: { name: tContent(badge.nameKey), description: tContent(badge.descriptionKey) },
      });
    }
  };

  const next = () => {
    if (!run) return;
    if (isRunOver(run)) finish(run);
    else setRun(nextChallenge(run, level, Math.random));
  };


  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <h1 className={run ? "text-sm text-ink-soft" : "font-display text-3xl font-semibold"}>{tContent(level.nameKey)}</h1>

      {run && (
        <ChallengeView
          key={run.index}
          level={level}
          run={run}
          onAnswer={(answerId) => setRun(submitAnswer(run, level, answerId))}
          onJoker={() => setRun(applyJoker(run, level, Math.random))}
          onNext={next}
          onQuit={() => void guard.leave()}
        />
      )}

      {outcome && (
        <LevelResult
          level={level}
          results={outcome.run.results}
          score={outcome.score}
          stars={outcome.stars}
          record={outcome.record}
          onReplay={start}
        />
      )}

      {!run && !outcome && !unlocked && previous && (
        <section className="fade-in flex items-start gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
          <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-gold" />
          <p>{t("journey.locked.hint", { count: UNLOCK_RULES.stars, level: tContent(previous.nameKey) })}</p>
        </section>
      )}

      {resumable && !outcome && (
        <section className="fade-in flex flex-col gap-4 rounded-3xl border border-gold/25 bg-surface/50 p-5">
          <h2 className="font-display text-xl font-semibold">{t("journey.resume.title")}</h2>
          <p className="text-ink-soft">
            {t("journey.resume.body", {
              current: resumable.index + 1,
              total: resumable.challengeIds.length,
              score: t("journey.game.score", { count: scoreOf(resumable) }),
            })}
          </p>
          <button type="button" onClick={() => setRun(resumable)} className={PRIMARY_BUTTON}>
            <Play aria-hidden className="size-5" />
            {t("journey.resume.continue")}
          </button>
          <button type="button" onClick={start} className={SECONDARY_BUTTON}>
            <RotateCcw aria-hidden className="size-5" />
            {t("journey.resume.restart")}
          </button>
        </section>
      )}

      {!run && !outcome && !resumable && unlocked && (
        <section className="fade-in flex flex-col gap-4 rounded-3xl border border-gold/25 bg-surface/50 p-5">
          <p className="text-ink-soft">{tContent(level.descriptionKey)}</p>
          <h2 className="font-display text-xl font-semibold">{t("journey.rules.title")}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-soft">
            <li>{t("journey.rules.challenges", { count: questionsPerRunOf(level) })}</li>
            <li>{t("journey.rules.attempts", { count: LEVEL_RULES.maxAttempts })}</li>
            <li>{t("journey.rules.jokers", { count: LEVEL_RULES.jokersPerLevel })}</li>
            <li>
              {t("journey.rules.points", {
                first: LEVEL_RULES.points.first,
                second: LEVEL_RULES.points.second,
                cost: LEVEL_RULES.points.first - LEVEL_RULES.points.firstWithJoker,
              })}
            </li>
            <li>
              {t("journey.rules.stars", {
                one: level.stars.one,
                oneEnd: level.stars.two - 1,
                two: level.stars.two,
                twoEnd: level.stars.three - 1,
                three: level.stars.three,
                max: maxScoreOf(level),
              })}
            </li>
          </ul>
          <button type="button" onClick={start} className={PRIMARY_BUTTON}>
            <Play aria-hidden className="size-5" />
            {t("journey.start")}
          </button>
        </section>
      )}

      {!run && <BackLink href={backHref} label={backLabel} />}
    </main>
  );
}
