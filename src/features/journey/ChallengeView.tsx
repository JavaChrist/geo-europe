"use client";

import { ArrowRight, Check, Flag, Lightbulb, Sparkles, WandSparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  answerStateOf,
  canUseJoker,
  currentChallenge,
  isAnswerAvailable,
  isHintVisible,
  isRunOver,
  LEVEL_RULES,
  scoreOf,
  type AnswerState,
  type LevelRun,
} from "@/engine/level-run";
import type { Level, LevelChallenge } from "@/engine/types";
import { useTranslation } from "@/i18n/I18nProvider";
import { ChallengeMap, ChallengePhoto } from "./ChallengeMedia";

const ANSWER_STYLES: Record<AnswerState, string> = {
  idle: "border-gold/30 bg-abyss/30 hover:border-gold hover:bg-gold/10 disabled:hover:border-gold/30 disabled:hover:bg-abyss/30",
  removed: "border-ink-soft/15 bg-transparent text-ink-soft/50 line-through",
  wrong: "border-danger bg-danger/15",
  correct: "border-success bg-success/15",
  revealed: "border-gold bg-gold/15",
};

const ANSWER_ICONS: Partial<Record<AnswerState, typeof Check>> = { wrong: X, correct: Check, revealed: Check };

interface ChallengeViewProps {
  level: Level;
  run: LevelRun;
  onAnswer: (answerId: string) => void;
  onJoker: () => void;
  onNext: () => void;
  onQuit: () => void;
}

function AnswerButtons({ challenge, run, onAnswer }: { challenge: LevelChallenge; run: LevelRun; onAnswer: (id: string) => void }) {
  const { tContent } = useTranslation();

  return (
    // Sous une photo, deux colonnes gardent les quatre réponses à portée de pouce.
    <ul className={`grid gap-2 ${challenge.kind === "visual" ? "grid-cols-2" : "sm:grid-cols-2"}`}>
      {run.answerOrder.map((id) => {
        const answer = challenge.answers.find((candidate) => candidate.id === id);
        if (!answer) return null;
        const state = answerStateOf(run, challenge, id);
        const Icon = ANSWER_ICONS[state];
        return (
          <li key={id}>
            <button
              type="button"
              disabled={!isAnswerAvailable(run, id)}
              onClick={() => onAnswer(id)}
              className={`flex h-full min-h-14 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left font-semibold wrap-anywhere transition-colors sm:px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${ANSWER_STYLES[state]}`}
            >
              <span className="min-w-0 flex-1">{tContent(answer.labelKey)}</span>
              {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Écran commun à tous les défis : seul le support (photo, carte) dépend du type de défi. */
export function ChallengeView({ level, run, onAnswer, onJoker, onNext, onQuit }: ChallengeViewProps) {
  const { t, tContent } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const hasFeedback = run.state !== "playing" || isHintVisible(run);
  const challenge = currentChallenge(run, level);
  const result = run.state === "playing" ? undefined : run.results.at(-1);
  const answerLabel = challenge.answers.find((answer) => answer.id === challenge.answerId)?.labelKey ?? "";

  // Le composant est recréé à chaque défi : le joueur repart du défi lui-même, le lecteur d'écran lit la question.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Sur mobile, le retour de réponse et le bouton suivant arrivent sous la carte ou la photo.
  useEffect(() => {
    if (hasFeedback) feedbackRef.current?.scrollIntoView({ block: "nearest" });
  }, [hasFeedback, run.state]);

  return (
    <div ref={rootRef} className="fade-in flex scroll-mt-2 flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-gold">
            {t("journey.game.progress", { current: run.index + 1, total: run.challengeIds.length })}
          </span>
          <span>{t("journey.game.score", { count: scoreOf(run) })}</span>
          <button
            type="button"
            onClick={onQuit}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
          >
            <Flag aria-hidden className="size-4" />
            {t("journey.game.quit")}
          </button>
        </div>
        <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-abyss/60">
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${(run.results.length / run.challengeIds.length) * 100}%` }}
          />
        </div>
      </header>

      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
        {tContent(challenge.promptKey)}
      </h2>

      {challenge.kind === "visual" && <ChallengePhoto challenge={challenge} />}
      {challenge.kind === "map" ? (
        <ChallengeMap challenge={challenge} run={run} onAnswer={onAnswer} />
      ) : (
        <AnswerButtons challenge={challenge} run={run} onAnswer={onAnswer} />
      )}

      <div ref={feedbackRef} className="flex scroll-mb-24 flex-col gap-4">
        <div aria-live="polite" className="flex flex-col gap-3">
          {isHintVisible(run) && (
            <div className="rounded-2xl border border-danger/50 bg-danger/10 p-4">
              <p className="font-semibold">{t("journey.game.wrong")}</p>
              <p className="mt-2 flex gap-2 text-ink-soft">
                <Lightbulb aria-hidden className="size-5 shrink-0 text-gold" />
                <span>{tContent(challenge.hintKey)}</span>
              </p>
            </div>
          )}
          {result && (
            <div className={`rounded-2xl border p-4 ${result.correct ? "border-success/50 bg-success/10" : "border-gold/50 bg-gold/10"}`}>
              <p className="font-semibold">
                {result.correct
                  ? t("journey.game.correct", { count: result.points })
                  : t("journey.game.failed", { answer: tContent(answerLabel) })}
              </p>
              <p className="mt-2 flex gap-2 text-ink-soft">
                <Sparkles aria-hidden className="size-5 shrink-0 text-gold" />
                <span>{tContent(challenge.anecdoteKey)}</span>
              </p>
            </div>
          )}
        </div>

        {run.state === "playing" ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={!canUseJoker(run, level)}
              onClick={onJoker}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/40 px-5 font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:border-ink-soft/20 disabled:text-ink-soft/60 disabled:hover:bg-transparent"
            >
              <WandSparkles aria-hidden className="size-5" />
              {t("journey.game.joker")}
            </button>
            <p className="text-center text-sm text-ink-soft">
              {t("journey.game.jokersLeft", { count: run.jokersLeft })}
              {" "}
              {t("journey.game.jokerCost", { cost: LEVEL_RULES.points.first - LEVEL_RULES.points.firstWithJoker })}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-abyss transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t(isRunOver(run) ?"journey.game.seeResult" : "journey.game.next")}
            <ArrowRight aria-hidden className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
