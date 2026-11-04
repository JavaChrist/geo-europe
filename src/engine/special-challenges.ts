/**
 * Défis spéciaux de fin de parcours, communs à tous les territoires et à tous les pays.
 * Un territoire n'apporte que ses questions et son badge : les règles vivent ici.
 */
import { questionsPerRunOf } from "./question-selection.ts";
import type { QuestionDifficulty, Territory } from "./types.ts";

export type SpecialChallengeKind = "master" | "chrono";

export interface SpecialChallengeRules {
  kind: SpecialChallengeKind;
  /** Dernier segment de l'adresse du défi. */
  slug: string;
  questions: number;
  minDifficulty: QuestionDifficulty;
  maxDifficulty: QuestionDifficulty;
  maxAttempts: number;
  jokers: number;
  /** Durée de toute la partie, `null` sans limite de temps. */
  timeLimitMs: number | null;
  /** Bonnes réponses à obtenir pour réussir, `null` pour un défi sans échec. */
  passCorrect: number | null;
}

export const SPECIAL_CHALLENGES: readonly SpecialChallengeRules[] = [
  {
    kind: "master",
    slug: "maitre",
    questions: 10,
    minDifficulty: 3,
    maxDifficulty: 3,
    maxAttempts: 1,
    jokers: 0,
    timeLimitMs: null,
    passCorrect: 8,
  },
  {
    kind: "chrono",
    slug: "chrono",
    questions: 10,
    minDifficulty: 2,
    maxDifficulty: 3,
    maxAttempts: 1,
    jokers: 0,
    timeLimitMs: 120_000,
    passCorrect: null,
  },
];

type ChallengeTerritory = Pick<Territory, "id" | "levels">;

/** Ce résultat vit à part de ceux des niveaux, sous cette clé : elle ne peut pas être un id de niveau. */
export const challengeKey = (territoryId: string, kind: SpecialChallengeKind): string => `${territoryId}:${kind}`;

/** Toutes les questions du territoire, dans les difficultés du défi : aucune n'est écrite pour lui. */
export const specialChallengeBank = (territory: ChallengeTerritory, rules: SpecialChallengeRules) => ({
  id: challengeKey(territory.id, rules.kind),
  minDifficulty: rules.minDifficulty,
  maxDifficulty: rules.maxDifficulty,
  questions: territory.levels.flatMap((level) => level.questions),
});

/** Sans assez de questions différentes, le défi n'est pas proposé : il ne s'en invente jamais. */
export const isSpecialChallengeAvailable = (territory: ChallengeTerritory, rules: SpecialChallengeRules): boolean =>
  questionsPerRunOf(specialChallengeBank(territory, rules), rules.questions) === rules.questions;

export const availableSpecialChallenges = (territory: ChallengeTerritory): SpecialChallengeRules[] =>
  SPECIAL_CHALLENGES.filter((rules) => isSpecialChallengeAvailable(territory, rules));

/** Ouverts quand tous les niveaux du parcours ont un résultat, quel que soit le score. */
export const areSpecialChallengesUnlocked = (
  levelIds: readonly string[],
  records: Readonly<Record<string, unknown>>,
): boolean => levelIds.length > 0 && levelIds.every((id) => records[id] !== undefined);

export const correctCount = (results: readonly { correct: boolean }[]): number => results.filter((result) => result.correct).length;

export const isChallengePassed = (rules: SpecialChallengeRules, correct: number): boolean =>
  rules.passCorrect !== null && correct >= rules.passCorrect;

export interface ChallengeRecord {
  plays: number;
  lastCorrect: number;
  /** Date ISO de la dernière partie terminée. */
  lastPlayedAt: string;
  /** Meilleure partie : le plus de bonnes réponses, puis le temps le plus court. */
  bestCorrect: number;
  /** Temps de cette meilleure partie en millisecondes, `null` pour un défi sans chronomètre. */
  bestTimeMs: number | null;
  /** Permanent : une partie moins bonne ne le retire jamais. */
  passed: boolean;
}

export type ChallengeRecords = Readonly<Record<string, ChallengeRecord | undefined>>;

export interface ChallengePerformance {
  correct: number;
  timeMs: number | null;
}

/** Classement : le nombre de bonnes réponses d'abord, le temps ensuite pour départager. */
export function isBetterPerformance(candidate: ChallengePerformance, best: ChallengePerformance): boolean {
  if (candidate.correct !== best.correct) return candidate.correct > best.correct;
  return candidate.timeMs !== null && best.timeMs !== null && candidate.timeMs < best.timeMs;
}

export function withChallengeResult(
  previous: ChallengeRecord | undefined,
  rules: SpecialChallengeRules,
  performance: ChallengePerformance,
  playedAt: string,
): ChallengeRecord {
  const improved = !previous || isBetterPerformance(performance, { correct: previous.bestCorrect, timeMs: previous.bestTimeMs });
  return {
    plays: (previous?.plays ?? 0) + 1,
    lastCorrect: performance.correct,
    lastPlayedAt: playedAt,
    bestCorrect: improved ? performance.correct : previous.bestCorrect,
    bestTimeMs: improved ? performance.timeMs : previous.bestTimeMs,
    passed: previous?.passed === true || isChallengePassed(rules, performance.correct),
  };
}

/** Point de départ d'un chronomètre, relevé sur les deux horloges de l'appareil. */
export interface ChronoClock {
  wall: number;
  monotonic: number;
}

/**
 * Temps écoulé depuis le départ, recalculé à chaque lecture sans dépendre des minuteurs, ralentis en arrière-plan.
 * L'horloge murale compte la mise en veille, l'horloge monotone résiste au changement d'heure :
 * garder la plus avancée ne laisse aucun moyen de gagner du temps.
 */
export const elapsedMs = (start: ChronoClock, now: ChronoClock): number =>
  Math.max(now.wall - start.wall, now.monotonic - start.monotonic, 0);

export const remainingMs = (limitMs: number, elapsed: number): number => Math.max(limitMs - elapsed, 0);
