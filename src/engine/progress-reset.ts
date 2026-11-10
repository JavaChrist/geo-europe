/**
 * Réinitialisation de la progression, commune à tous les territoires et à tous les pays.
 * Seuls les résultats sont effacés : cartes, badges, déblocages et XP s'en déduisent, le catalogue n'est jamais touché.
 */
import { albumCollections, type AlbumTerritory, summarizeCollections } from "./album.ts";
import { starsFor } from "./level-run.ts";
import { isLevelUnlocked } from "./level-unlock.ts";
import { type DailyRecords, dailyXpTotal, isNationalBadgeEarned, type NationalBadge } from "./national-challenges.ts";
import { earnedXp, type ProgressRecord } from "./progress-summary.ts";
import { areSpecialChallengesUnlocked, availableSpecialChallenges, challengeKey, type ChallengeRecords, SPECIAL_CHALLENGES } from "./special-challenges.ts";
import type { Territory } from "./types.ts";

export type ResetScope =
  | { kind: "level"; levelId: string }
  | { kind: "territory"; territoryId: string }
  | { kind: "country" };

export type ResetTerritory = AlbumTerritory & Pick<Territory, "levels" | "masterPassCorrect">;

/** Clés à effacer, ou tout l'espace du profil actif. */
export type ResetTargets = "all" | { levels: string[]; questions: string[]; challenges: string[] };

/** L'espace d'un profil. L'historique des questions d'un niveau porte l'id du niveau, celui d'un défi porte la clé du défi. */
export interface ResettableSpace<L, Q, C> {
  levels: Record<string, L>;
  questions: Record<string, Q>;
  challenges: Record<string, C>;
}

export function resetTargets(scope: ResetScope, territories: readonly ResetTerritory[]): ResetTargets {
  if (scope.kind === "country") return "all";
  if (scope.kind === "level") return { levels: [scope.levelId], questions: [scope.levelId], challenges: [] };
  const territory = territories.find((candidate) => candidate.id === scope.territoryId);
  if (!territory) return { levels: [], questions: [], challenges: [] };
  const levels = territory.levels.map((level) => level.id);
  const challenges = SPECIAL_CHALLENGES.map((rules) => challengeKey(territory.id, rules.kind));
  return { levels, questions: [...levels, ...challenges], challenges };
}

const without = <T>(entries: Record<string, T>, keys: readonly string[]): Record<string, T> =>
  Object.fromEntries(Object.entries(entries).filter(([key]) => !keys.includes(key)));

export function applyReset<L, Q, C>(space: ResettableSpace<L, Q, C>, targets: ResetTargets): ResettableSpace<L, Q, C> {
  if (targets === "all") return { levels: {}, questions: {}, challenges: {} };
  return {
    levels: without(space.levels, targets.levels),
    questions: without(space.questions, targets.questions),
    challenges: without(space.challenges, targets.challenges),
  };
}

/** Ce que l'opération effacerait vraiment, à afficher avant toute confirmation. */
export interface ResetPreview {
  /** Faux s'il n'y a aucun résultat dans cette portée. */
  hasData: boolean;
  levels: number;
  stars: number;
  score: number;
  plays: number;
  xp: number;
  challenges: number;
  cards: number;
  badges: number;
  /** Niveaux qui se verrouillent à nouveau, par les règles habituelles. */
  relockedLevels: number;
  /** Territoires dont les défis spéciaux se verrouillent à nouveau. */
  relockedChallenges: number;
  /** Jours du Défi du jour effacés : seule la réinitialisation du pays les touche. */
  days: number;
}

/** Défis nationaux du pays : seule la réinitialisation du pays les efface. */
export interface ResetNational {
  daily: DailyRecords;
  badges: readonly NationalBadge[];
}

const NO_NATIONAL: ResetNational = { daily: {}, badges: [] };

type LevelRecords = Readonly<Record<string, ProgressRecord & { plays: number }>>;

const openLevels = (territory: ResetTerritory, records: LevelRecords): string[] =>
  territory.levels.filter((level, index) => isLevelUnlocked(territory.levels[index - 1] ?? null, records)).map((level) => level.id);

export function previewReset(
  scope: ResetScope,
  territories: readonly ResetTerritory[],
  records: LevelRecords,
  challenges: ChallengeRecords,
  national: ResetNational = NO_NATIONAL,
): ResetPreview {
  const targets = resetTargets(scope, territories);
  const after = applyReset({ levels: records, questions: {}, challenges }, targets);

  const preview: ResetPreview = {
    hasData: Object.keys(after.levels).length < Object.keys(records).length || Object.keys(after.challenges).length < Object.keys(challenges).length,
    levels: 0,
    stars: 0,
    score: 0,
    plays: 0,
    xp: 0,
    challenges: Object.keys(challenges).length - Object.keys(after.challenges).length,
    cards: 0,
    badges: 0,
    relockedLevels: 0,
    relockedChallenges: 0,
    days: 0,
  };

  for (const territory of territories) {
    for (const level of territory.levels) {
      const record = records[level.id];
      if (!record || after.levels[level.id]) continue;
      preview.levels += 1;
      preview.stars += starsFor(record.bestScore, level.stars);
      preview.score += record.bestScore;
      preview.plays += record.plays;
      preview.xp += earnedXp(record);
    }
    const stillOpen = openLevels(territory, after.levels);
    preview.relockedLevels += openLevels(territory, records).filter((id) => !stillOpen.includes(id)).length;
    const levelIds = territory.levels.map((level) => level.id);
    if (availableSpecialChallenges(territory).length > 0 && areSpecialChallengesUnlocked(levelIds, records) && !areSpecialChallengesUnlocked(levelIds, after.levels)) {
      preview.relockedChallenges += 1;
    }
  }

  const collections = albumCollections(territories);
  const rewardsBefore = summarizeCollections(collections, records, challenges);
  const rewardsAfter = summarizeCollections(collections, after.levels, after.challenges);
  preview.cards = rewardsBefore.cardsEarned - rewardsAfter.cardsEarned;
  preview.badges = rewardsBefore.badgesEarned - rewardsAfter.badgesEarned;

  if (targets === "all") {
    preview.days = Object.values(national.daily).filter(Boolean).length;
    preview.xp += dailyXpTotal(national.daily);
    preview.badges += national.badges.filter((badge) => isNationalBadgeEarned(badge, challenges)).length;
    if (preview.days > 0) preview.hasData = true;
  }
  return preview;
}
