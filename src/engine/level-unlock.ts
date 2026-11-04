/** Déblocage des niveaux d'un parcours, commun à tous les pays. */
import { maxScoreOf, starsFor } from "./level-run.ts";
import type { Level } from "./types.ts";

export const UNLOCK_RULES = {
  /** Étoiles à obtenir au niveau précédent. Une partie terminée en donne déjà une, même à 0 point. */
  stars: 2,
} as const;

/** Ce qu'un écran doit savoir d'un niveau, sans transporter toute sa banque de questions. */
export interface LevelSummary extends Pick<Level, "id" | "nameKey" | "descriptionKey" | "stars"> {
  maxScore: number;
}

export const summarizeLevel = (level: Level): LevelSummary => ({
  id: level.id,
  nameKey: level.nameKey,
  descriptionKey: level.descriptionKey,
  stars: level.stars,
  maxScore: maxScoreOf(level),
});

/** Niveau à réussir avant celui de cette position, `null` pour le premier du parcours. */
export function previousSummary(levels: readonly Level[], index: number): LevelSummary | null {
  const previous = levels[index - 1];
  return previous ? summarizeLevel(previous) : null;
}

/** Le premier niveau d'un parcours (`previous` vaut `null`) est toujours ouvert. */
export function isLevelUnlocked(
  previous: Pick<Level, "id" | "stars"> | null,
  records: Readonly<Record<string, { bestScore: number } | undefined>>,
): boolean {
  if (!previous) return true;
  const record = records[previous.id];
  return record !== undefined && starsFor(record.bestScore, previous.stars) >= UNLOCK_RULES.stars;
}
