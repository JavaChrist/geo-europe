/** Cumuls de progression et XP, communs à tous les pays. Tout se recalcule depuis les résultats enregistrés. */
import { starsFor } from "./level-run.ts";
import type { LevelSummary } from "./level-unlock.ts";

export const XP_RULES = {
  /** Points de score à marquer pour gagner 1 XP, arrondi à l'unité inférieure. */
  pointsPerXp: 10,
} as const;

const STARS_PER_LEVEL = 3;

/** Le minimum qu'un résultat doit fournir aux cumuls. */
export interface ProgressRecord {
  bestScore: number;
  /** Absent des résultats enregistrés avant l'arrivée de l'XP. */
  xp?: number;
}

export type ProgressLevel = Pick<LevelSummary, "id" | "stars" | "maxScore">;

export interface ProgressTerritory {
  id: string;
  levels: readonly ProgressLevel[];
}

type ProgressRecords = Readonly<Record<string, ProgressRecord | undefined>>;

export interface ProgressSummary {
  levelsFinished: number;
  levelsTotal: number;
  /** Chaque niveau ne compte qu'une fois, pour son meilleur score. */
  bestScoreTotal: number;
  bestScoreMax: number;
  stars: number;
  starsMax: number;
  xp: number;
}

export interface CountryProgress extends ProgressSummary {
  /** Territoires avec au moins un niveau terminé. */
  territoriesExplored: number;
}

export const xpForScore = (score: number): number => Math.floor(score / XP_RULES.pointsPerXp);

/** Une ancienne partie sans XP enregistré compte pour son meilleur score : le seul résultat encore connu. */
export const earnedXp = (record: ProgressRecord): number => record.xp ?? xpForScore(record.bestScore);

/** Chaque partie terminée rapporte de l'XP, record ou non. */
export const xpAfterRun = (previous: ProgressRecord | undefined, score: number): number =>
  (previous ? earnedXp(previous) : 0) + xpForScore(score);

export function summarizeProgress(levels: readonly ProgressLevel[], records: ProgressRecords): ProgressSummary {
  const summary: ProgressSummary = {
    levelsFinished: 0,
    levelsTotal: levels.length,
    bestScoreTotal: 0,
    bestScoreMax: 0,
    stars: 0,
    starsMax: levels.length * STARS_PER_LEVEL,
    xp: 0,
  };
  for (const level of levels) {
    summary.bestScoreMax += level.maxScore;
    const record = records[level.id];
    if (!record) continue;
    summary.levelsFinished += 1;
    summary.bestScoreTotal += record.bestScore;
    summary.stars += starsFor(record.bestScore, level.stars);
    summary.xp += earnedXp(record);
  }
  return summary;
}

/** Mêmes règles que pour un territoire, sur tout le pays. */
export function summarizeCountry(territories: readonly ProgressTerritory[], records: ProgressRecords): CountryProgress {
  return {
    ...summarizeProgress(territories.flatMap((territory) => territory.levels), records),
    territoriesExplored: territories.filter((territory) => territory.levels.some((level) => records[level.id])).length,
  };
}
