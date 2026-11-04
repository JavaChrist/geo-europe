"use client";

import { Lock, Play } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type MouseEvent, useEffect, useState } from "react";
import content from "@country";
import { newRewards } from "@/engine/album";
import { isRunOver, type LevelRun, nextChallenge, startRun, submitAnswer } from "@/engine/level-run";
import { EMPTY_HISTORY } from "@/engine/question-selection";
import {
  areSpecialChallengesUnlocked,
  availableSpecialChallenges,
  type ChallengeRecord,
  type ChronoClock,
  challengeKey,
  correctCount,
  drawSpecialChallenge,
  elapsedMs,
  isBetterPerformance,
  lastPlayedLevelId,
  remainingMs,
  type SpecialChallengeKind,
  specialChallengeBank,
} from "@/engine/special-challenges";
import { useTranslation } from "@/i18n/I18nProvider";
import { readQuestionHistory, recordChallengeResult } from "@/services/local-progress";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { ChallengeView } from "./ChallengeView";
import { canReturnThroughHistory, challengeListPath, ORIGIN_PARAM } from "./challenge-origin";
import { formatCountdown } from "./challenge-time";
import { SpecialChallengeResult } from "./SpecialChallengeResult";
import { SPECIAL_ICONS } from "./SpecialChallenges";
import { useChallengeRecords, useLevelRecords } from "./useLevelRecords";

/** En dessous, le chronomètre passe à la couleur d'alerte. */
const URGENT_MS = 15_000;

const readClock = (): ChronoClock => ({ wall: Date.now(), monotonic: performance.now() });

interface CountdownProps {
  start: ChronoClock;
  limitMs: number;
  /** Temps figé à la dernière réponse, `null` tant que la partie court. */
  stoppedMs: number | null;
  onExpire: () => void;
}

/** Le temps se recalcule depuis les horloges : un minuteur ralenti en arrière-plan n'en fait pas gagner. */
function Countdown({ start, limitMs, stoppedMs, onExpire }: CountdownProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (stoppedMs !== null) return;
    const tick = () => {
      const now = elapsedMs(start, readClock());
      if (now >= limitMs) onExpire();
      else setElapsed(now);
    };
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    window.addEventListener("pageshow", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
      window.removeEventListener("pageshow", tick);
    };
  }, [start, limitMs, stoppedMs, onExpire]);

  const left = remainingMs(limitMs, stoppedMs ?? elapsed);
  const urgent = left <= URGENT_MS;

  return (
    <div
      role="timer"
      aria-label={t("journey.specials.game.timer", { time: formatCountdown(left) })}
      className={`sticky top-0 z-10 flex flex-col gap-1.5 rounded-2xl border bg-abyss/95 px-4 py-2 backdrop-blur ${urgent ? "border-danger" : "border-gold/40"}`}
    >
      <span className={`text-center font-display text-2xl font-semibold tabular-nums ${urgent ? "text-danger" : "text-gold"}`}>{formatCountdown(left)}</span>
      <span aria-hidden className="h-1 overflow-hidden rounded-full bg-surface/80">
        <span className={`block h-full rounded-full ${urgent ? "bg-danger" : "bg-gold"}`} style={{ width: `${(left / limitMs) * 100}%` }} />
      </span>
    </div>
  );
}

interface Outcome {
  run: LevelRun;
  timeMs: number | null;
  expired: boolean;
  improved: boolean;
  newBadgeName: string | null;
  record: ChallengeRecord | null;
}

interface SpecialChallengeGameProps {
  territoryId: string;
  kind: SpecialChallengeKind;
  backHref: string;
  backLabel: string;
}

/** Déroulé des deux défis, pour tous les territoires : seule la configuration les distingue. */
export function SpecialChallengeGame({ territoryId, kind, backHref, backLabel }: SpecialChallengeGameProps) {
  const { t, tContent } = useTranslation();
  const modal = useModal();
  const router = useRouter();
  const origin = useSearchParams().get(ORIGIN_PARAM);
  const records = useLevelRecords();
  const challenges = useChallengeRecords();
  // La partie démarre au clic : le tirage, l'ordre des réponses et l'heure de départ n'existent pas au rendu serveur.
  const [run, setRun] = useState<LevelRun | null>(null);
  const [clock, setClock] = useState<ChronoClock | null>(null);
  const [stoppedMs, setStoppedMs] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const territory = content.territories.find((candidate) => candidate.id === territoryId);
  const rules = territory && availableSpecialChallenges(territory).find((candidate) => candidate.kind === kind);
  if (!territory || !rules) return null;

  const bank = specialChallengeBank(territory, rules);
  const limitMs = rules.timeLimitMs;
  const levelIds = territory.levels.map((level) => level.id);
  const unlocked = areSpecialChallengesUnlocked(levelIds, records);
  const masterBadge = territory.badges.find((badge) => badge.kind === "master");
  const Icon = SPECIAL_ICONS[kind];
  const name = t(`journey.specials.${kind}.name`);
  const fromList = origin === "defis";
  const returnHref = fromList ? challengeListPath(rules.slug) : backHref;
  const returnLabel = fromList ? t("challenges.backToList") : backLabel;
  // L'écran d'où vient le joueur est juste avant dans l'historique : y revenir n'ajoute pas d'entrée, donc pas de boucle.
  const canGoBack = () => origin !== null && canReturnThroughHistory();

  const onBack = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || !canGoBack()) return;
    event.preventDefault();
    router.back();
  };

  const start = () => {
    setOutcome(null);
    setStoppedMs(null);
    const history = readQuestionHistory(content.country.code, bank.id);
    const lastLevelId = lastPlayedLevelId(levelIds, records);
    const lastLevel = lastLevelId ? readQuestionHistory(content.country.code, lastLevelId) : EMPTY_HISTORY;
    setRun(startRun(bank, drawSpecialChallenge(bank, rules, history, lastLevel, Math.random), Math.random, rules));
    setClock(readClock());
  };

  const finish = (finished: LevelRun, timeMs: number | null, expired: boolean) => {
    const key = challengeKey(territory.id, kind);
    const previous = challenges[key];
    const performance = { correct: correctCount(finished.results), timeMs };
    let record: ChallengeRecord | null = null;
    try {
      record = recordChallengeResult(content.country.code, key, rules, performance, finished.results);
    } catch (error) {
      void modal.error(error);
    }
    // Seulement au premier gain : un rejeu ne fait rien gagner de nouveau.
    const badges = record ? newRewards(content.territories, records, records, challenges, { ...challenges, [key]: record }).badges : [];
    for (const badge of badges) {
      void modal.reward({
        titleKey: "album.reward.badgeTitle",
        bodyKey: "album.reward.badgeBody",
        values: { name: tContent(badge.nameKey), description: tContent(badge.descriptionKey) },
      });
    }
    setOutcome({
      run: finished,
      timeMs,
      expired,
      improved: !previous || isBetterPerformance(performance, { correct: previous.bestCorrect, timeMs: previous.bestTimeMs }),
      newBadgeName: badges[0] ? tContent(badges[0].nameKey) : null,
      record,
    });
    setRun(null);
  };

  /** Temps écoulé, ou `null` si le temps est déjà dépassé et la partie vient de se terminer. */
  const liveElapsed = (current: LevelRun): number | null => {
    if (limitMs === null || !clock) return 0;
    const elapsed = elapsedMs(clock, readClock());
    if (elapsed < limitMs) return elapsed;
    finish(current, limitMs, true);
    return null;
  };

  const answer = (answerId: string) => {
    if (!run) return;
    // Une réponse arrivée après la fin du temps ne compte pas, même si l'écran n'a pas encore eu le temps de se mettre à jour.
    const elapsed = liveElapsed(run);
    if (elapsed === null) return;
    const answered = submitAnswer(run, bank, answerId);
    setRun(answered);
    if (limitMs !== null && isRunOver(answered)) setStoppedMs(Math.round(elapsed));
  };

  const next = () => {
    if (!run) return;
    if (isRunOver(run)) finish(run, limitMs === null ? null : stoppedMs, false);
    else if (liveElapsed(run) !== null) setRun(nextChallenge(run, bank, Math.random));
  };

  const quit = async () => {
    const confirmed = await modal.confirm({
      titleKey: "journey.game.quitTitle",
      bodyKey: "journey.game.quitBody",
      confirmKey: "journey.game.quit",
    });
    if (!confirmed) return;
    if (canGoBack()) router.back();
    else router.push(returnHref);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      {run ? (
        <h1 className="text-sm text-ink-soft">{name}</h1>
      ) : (
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            <Icon aria-hidden className="size-7 shrink-0 text-gold" />
            {name}
          </h1>
          <p className="text-sm text-sky">{tContent(territory.nameKey)}</p>
        </div>
      )}

      {run && limitMs !== null && clock && (
        <Countdown start={clock} limitMs={limitMs} stoppedMs={stoppedMs} onExpire={() => finish(run, limitMs, true)} />
      )}

      {run && (
        <ChallengeView
          key={run.index}
          level={bank}
          run={run}
          special={{ timed: limitMs !== null }}
          onAnswer={answer}
          onNext={next}
          onQuit={() => void quit()}
        />
      )}

      {outcome && (
        <SpecialChallengeResult
          rules={rules}
          bank={bank}
          challengeIds={outcome.run.challengeIds}
          results={outcome.run.results}
          timeMs={outcome.timeMs}
          expired={outcome.expired}
          improved={outcome.improved}
          newBadgeName={outcome.newBadgeName}
          keptBadgeName={outcome.record?.passed && masterBadge ? tContent(masterBadge.nameKey) : null}
          record={outcome.record}
          onReplay={start}
          backHref={returnHref}
          backLabel={returnLabel}
          onBack={onBack}
        />
      )}

      {!run && !outcome && !unlocked && (
        <section className="fade-in flex items-start gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
          <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-gold" />
          <p>{t("journey.specials.locked", { count: territory.levels.length })}</p>
        </section>
      )}

      {!run && !outcome && unlocked && (
        <section className="fade-in flex flex-col gap-4 rounded-3xl border border-gold/25 bg-surface/50 p-5">
          <p className="text-ink-soft">{t(`journey.specials.${kind}.description`)}</p>
          <h2 className="font-display text-xl font-semibold">{t("journey.specials.rules.title")}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-soft">
            <li>{t("journey.specials.rules.questions", { count: rules.questions })}</li>
            <li>{limitMs === null ? t("journey.specials.rules.noLimit") : t("journey.specials.rules.timeLimit", { seconds: limitMs / 1000 })}</li>
            <li>{t("journey.specials.rules.oneAttempt")}</li>
            {rules.passCorrect !== null && <li>{t("journey.specials.rules.pass", { count: rules.passCorrect })}</li>}
            {rules.passCorrect !== null && masterBadge && <li>{t("journey.specials.rules.badge", { name: tContent(masterBadge.nameKey) })}</li>}
            {limitMs !== null && <li>{t("journey.specials.rules.clock")}</li>}
            {limitMs !== null && <li>{t("journey.specials.rules.ranking")}</li>}
            <li>{t("journey.specials.rules.separate")}</li>
          </ul>
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-abyss transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <Play aria-hidden className="size-5" />
            {t("journey.start")}
          </button>
        </section>
      )}

      {!run && !outcome && <BackLink href={returnHref} label={returnLabel} onClick={onBack} />}
    </main>
  );
}
