"use client";

import { CalendarCheck, CalendarDays, Flame, Play, Smartphone, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { isRunOver, isRunResumable, type LevelRun, nextChallenge, startRun, submitAnswer } from "@/engine/level-run";
import {
  accessibleTerritories,
  DAILY_PAUSED_KEY,
  DAILY_RULES,
  DAILY_XP,
  type DailyRecord,
  dailyBank,
  dailyStreak,
  dayOf,
  dayOfBankId,
  drawDaily,
  isBankPlayable,
  type NationalBank,
} from "@/engine/national-challenges";
import { correctCount } from "@/engine/special-challenges";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { CheckingAccess } from "@/features/account/RegionGate";
import { AnswerReview } from "@/features/journey/SpecialChallengeResult";
import { ChallengeView } from "@/features/journey/ChallengeView";
import { useDailyRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import content from "@country";
import { recordDailyResult } from "@/services/local-progress";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, primaryButton } from "@/ui/styles";
import { freeRegionNames, PUBLISHED_TERRITORIES } from "./national-content";
import { useNationalRun } from "./useNationalRun";

/** Le jour change à minuit : relu chaque minute et au retour sur l'onglet. */
function subscribeToDay(listener: () => void): () => void {
  const interval = window.setInterval(listener, 30_000);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", listener);
  };
}

/** Jour local de l'appareil, `null` au rendu serveur. */
function useToday(): string | null {
  return useSyncExternalStore(subscribeToDay, () => dayOf(new Date()), () => null);
}

/** Toutes les questions publiées du jour : une partie gardée reste jouable même si les droits changent entre-temps. */
const banks = new Map<string, NationalBank>();
function playBank(day: string): NationalBank {
  let bank = banks.get(day);
  if (!bank) {
    bank = dailyBank(PUBLISHED_TERRITORIES, day);
    banks.set(day, bank);
  }
  return bank;
}

interface Outcome {
  run: LevelRun;
  day: string;
  /** `null` : l'enregistrement a échoué, le joueur en a été prévenu. */
  record: DailyRecord | null;
  added: boolean;
}

function Streak({ current, best }: { current: number; best: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="flex items-center gap-2 font-semibold">
        <Flame aria-hidden className="size-5 shrink-0 text-gold" />
        {t("challenges.national.daily.current", { count: current })}
      </p>
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Trophy aria-hidden className="size-4 shrink-0" />
        {t("challenges.national.daily.best", { count: best })}
      </p>
    </div>
  );
}

/**
 * Défi du jour : 5 questions tirées pour la journée dans les régions accessibles, une récompense par jour.
 * Pas de « Recommencer » : une partie commencée se termine, même après minuit, et compte pour son jour de départ.
 */
export function DailyChallenge() {
  const { t, tContent, locale } = useTranslation();
  const modal = useModal();
  const today = useToday();
  const daily = useDailyRecords();
  const { entitlements, status, canPlayRegion } = useEntitlements();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { run, setRun, paused, promotion, quit, clearPaused } = useNationalRun(DAILY_PAUSED_KEY, "/defis");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const runDay = run ? dayOfBankId(run.levelId) : null;
  const runBank = runDay ? playBank(runDay) : null;
  const pausedLevelId = typeof paused === "object" && paused !== null ? (paused as { levelId?: unknown }).levelId : undefined;
  const pausedDay = typeof pausedLevelId === "string" ? dayOfBankId(pausedLevelId) : null;
  const pausedDone = pausedDay !== null && daily[pausedDay] !== undefined;
  const resumableRun = !run && !outcome && pausedDay && !pausedDone && isRunResumable(paused, playBank(pausedDay)) ? paused : null;

  // Une partie gardée d'un jour déjà terminé (second onglet) ne peut plus rien rapporter.
  useEffect(() => {
    if (pausedDone) clearPaused();
  }, [pausedDone, clearPaused]);

  useEffect(() => {
    if (!outcome) return;
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [outcome]);

  // Le tirage dépend des régions accessibles : il attend que les droits soient connus.
  const drawBank = useMemo(
    () => (today && status !== "loading" ? dailyBank(accessibleTerritories(PUBLISHED_TERRITORIES, canPlayRegion), today) : null),
    [today, status, canPlayRegion],
  );

  if (!today || (!run && !outcome && !resumableRun && !drawBank)) return <CheckingAccess />;

  const streak = dailyStreak(daily, today);
  const todayRecord = daily[today];
  const playable = drawBank !== null && isBankPlayable(drawBank, DAILY_RULES);
  const title = t("challenges.modes.daily.title");
  const formatDay = (day: string) => {
    const [year, month, date] = day.split("-").map(Number) as [number, number, number];
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(year, month - 1, date));
  };

  const start = () => {
    if (!drawBank || todayRecord) return;
    setOutcome(null);
    setRun(startRun(playBank(today), drawDaily(drawBank, today), Math.random, DAILY_RULES));
  };

  const finish = (finished: LevelRun) => {
    const day = dayOfBankId(finished.levelId);
    if (!day) return;
    // Avant l'enregistrement : une partie terminée ne peut plus être reprise, l'XP du jour ne se compte qu'une fois.
    clearPaused();
    let saved: { record: DailyRecord | null; added: boolean } = { record: null, added: false };
    try {
      saved = recordDailyResult(content.country.code, day, correctCount(finished.results));
    } catch (error) {
      void modal.error(error);
    }
    setOutcome({ run: finished, day, ...saved });
    setRun(null);
    promotion.gameCompleted();
  };

  const answer = (answerId: string) => {
    if (run && runBank) setRun(submitAnswer(run, runBank, answerId));
  };

  const next = () => {
    if (!run || !runBank) return;
    if (isRunOver(run)) finish(run);
    else setRun(nextChallenge(run, runBank, Math.random));
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      {promotion.overlay}
      {run ? (
        <h1 className="text-sm text-ink-soft">{title}</h1>
      ) : (
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            <CalendarDays aria-hidden className="size-7 shrink-0 text-gold" />
            {title}
          </h1>
          <p className="text-sm text-sky">{formatDay(outcome?.day ?? (resumableRun ? pausedDay : null) ?? today)}</p>
        </div>
      )}

      {run && runBank && (
        <ChallengeView key={run.index} level={runBank} run={run} special={{ timed: false }} onAnswer={answer} onNext={next} onQuit={quit} />
      )}

      {outcome && (
        <div className="fade-in flex flex-col gap-4">
          <section className="flex flex-col items-center gap-3 rounded-3xl border border-gold/25 bg-surface/60 px-5 py-8 text-center">
            <h2 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
              {t("challenges.national.daily.doneTitle")}
            </h2>
            <p className="text-xl font-semibold text-gold">
              {t("journey.specials.result.score", { count: correctCount(outcome.run.results), total: DAILY_RULES.questions })}
            </p>
            {outcome.record && (
              <p className="font-semibold">
                {outcome.added ? t("challenges.national.daily.xpEarned", { count: outcome.record.xp }) : t("challenges.national.daily.xpAlready")}
              </p>
            )}
            <Streak current={streak.current} best={streak.best} />
            {outcome.day !== today && <p className="text-sm text-ink-soft">{t("challenges.national.daily.earlierDay", { date: formatDay(outcome.day) })}</p>}
            {(outcome.day === today || todayRecord) && <p>{t("challenges.national.daily.comeBack")}</p>}
            <p className="flex items-center gap-2 text-sm text-ink-soft">
              <Smartphone aria-hidden className="size-4 shrink-0" />
              {t(outcome.record ? "journey.deviceOnly" : "journey.result.notSaved")}
            </p>
          </section>
          {outcome.day !== today && !todayRecord && (
            <button type="button" onClick={() => setOutcome(null)} className={primaryButton}>
              <Play aria-hidden className="size-5" />
              {t("challenges.national.daily.playToday")}
            </button>
          )}
          <BackLink href="/defis" label={t("challenges.backToHub")} />
          <AnswerReview bank={playBank(outcome.day)} challengeIds={outcome.run.challengeIds} results={outcome.run.results} />
        </div>
      )}

      {resumableRun && pausedDay && (
        <section className={card}>
          <h2 className="font-display text-xl font-semibold">{t("journey.resume.title")}</h2>
          <p className="text-ink-soft">
            {t("journey.resume.bodySpecial", {
              current: resumableRun.index + 1,
              total: resumableRun.challengeIds.length,
              tally: t("journey.specials.game.tally", { count: correctCount(resumableRun.results) }),
            })}
          </p>
          {pausedDay !== today && <p className="text-ink-soft">{t("challenges.national.daily.earlierDay", { date: formatDay(pausedDay) })}</p>}
          <button type="button" onClick={() => setRun(resumableRun)} className={primaryButton}>
            <Play aria-hidden className="size-5" />
            {t("journey.resume.continue")}
          </button>
        </section>
      )}

      {!run && !outcome && !resumableRun && todayRecord && (
        <section className="fade-in flex flex-col items-center gap-3 rounded-3xl border border-gold/25 bg-surface/60 px-5 py-8 text-center">
          <CalendarCheck aria-hidden className="size-8 text-gold" />
          <h2 className="font-display text-2xl font-semibold">{t("challenges.national.daily.doneTitle")}</h2>
          <p className="text-xl font-semibold text-gold">{t("journey.specials.result.score", { count: todayRecord.correct, total: DAILY_RULES.questions })}</p>
          <p className="font-semibold">{t("challenges.national.daily.xpEarned", { count: todayRecord.xp })}</p>
          <Streak current={streak.current} best={streak.best} />
          <p>{t("challenges.national.daily.comeBack")}</p>
        </section>
      )}

      {!run && !outcome && !resumableRun && !todayRecord && !playable && (
        <section className={card}>
          <p className="text-ink-soft">{t("challenges.national.daily.unavailable")}</p>
        </section>
      )}

      {!run && !outcome && !resumableRun && !todayRecord && playable && (
        <section className={card}>
          <p className="text-ink-soft">{t("challenges.national.daily.description")}</p>
          <h2 className="font-display text-xl font-semibold">{t("journey.specials.rules.title")}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-soft">
            <li>{t("challenges.national.daily.rules.questions", { count: DAILY_RULES.questions })}</li>
            <li>{t("journey.specials.rules.noLimit")}</li>
            <li>{t("journey.specials.rules.oneAttempt")}</li>
            <li>{t("challenges.national.daily.rules.xp", { bonus: DAILY_XP.completionBonus, count: DAILY_RULES.questions })}</li>
            <li>{t("challenges.national.daily.rules.streak")}</li>
            <li>{t("challenges.national.daily.rules.midnight")}</li>
            {!entitlements.fullGameAccess && <li>{t("challenges.national.daily.rules.discovery", { regions: freeRegionNames(tContent, locale) })}</li>}
          </ul>
          {streak.best > 0 && <Streak current={streak.current} best={streak.best} />}
          <button type="button" onClick={start} className={primaryButton}>
            <Play aria-hidden className="size-5" />
            {t("challenges.national.daily.start")}
          </button>
        </section>
      )}

      {!run && !outcome && <BackLink href="/defis" label={t("challenges.backToHub")} />}
    </main>
  );
}
