/**
 * Défis nationaux, communs à tous les pays : Défi du jour, Défi de France et Défis thématiques.
 * Règles validées dans `docs/defis-nationaux.md`. Un pays n'apporte que ses questions, ses thèmes et ses textes.
 */
import { EMPTY_HISTORY, type QuestionBank, type QuestionHistory, questionsPerRunOf, selectQuestions } from "./question-selection.ts";
import { type RandomSource, seededRandom } from "./random.ts";
import { type ChallengeFormat, type ChallengeRecords, SPECIAL_CHALLENGES } from "./special-challenges.ts";
import type { FamilyTheme, LevelChallenge, Territory } from "./types.ts";

const MASTER = SPECIAL_CHALLENGES.find((rules) => rules.kind === "master");
if (!MASTER) throw new Error("Règles du Défi Maître introuvables");

/** Le Défi de France et les Défis thématiques reprennent les règles du Défi Maître. */
const MASTER_FORMAT: ChallengeFormat = {
  questions: MASTER.questions,
  minDifficulty: MASTER.minDifficulty,
  maxDifficulty: MASTER.maxDifficulty,
  maxAttempts: MASTER.maxAttempts,
  jokers: MASTER.jokers,
  timeLimitMs: MASTER.timeLimitMs,
  passCorrect: MASTER.passCorrect,
  coverCategories: MASTER.coverCategories,
  // Un défi national n'est lié à aucun niveau.
  avoidLastLevel: false,
};

export const DAILY_RULES: ChallengeFormat = {
  questions: 5,
  minDifficulty: 1,
  maxDifficulty: 3,
  maxAttempts: 1,
  jokers: 0,
  timeLimitMs: null,
  passCorrect: null,
  coverCategories: true,
  avoidLastLevel: false,
};

export const FRANCE_RULES: ChallengeFormat = MASTER_FORMAT;
export const THEME_RULES: ChallengeFormat = MASTER_FORMAT;

/** XP du Défi du jour, gagné une seule fois par jour, quand les 5 questions sont terminées. */
export const DAILY_XP = { perCorrect: 1, completionBonus: 5 } as const;

export const dailyXp = (correct: number): number => correct * DAILY_XP.perCorrect + DAILY_XP.completionBonus;

// --- Clés : elles ne peuvent être ni un id de niveau, ni la clé d'un défi régional (`<territoire>:<défi>`). ---

export const FRANCE_KEY = "national:france";

export type ThemeAccess = "full" | "discovery";

/** Le défi complet donne le badge ; celui de la Découverte est gardé à part, sans badge. */
export const themeKey = (themeId: string, access: ThemeAccess): string =>
  access === "full" ? `national:theme:${themeId}` : `national:theme:${themeId}:discovery`;

/** Partie gardée du Défi du jour : une seule à la fois, son jour est écrit dans l'id de sa banque. */
export const DAILY_PAUSED_KEY = "national:daily";

const DAILY_PREFIX = "national:daily:";
export const dailyBankId = (day: string): string => `${DAILY_PREFIX}${day}`;

/** Le jour d'une partie gardée, ou `null` si l'id n'est pas celui d'un Défi du jour. */
export function dayOfBankId(id: unknown): string | null {
  if (typeof id !== "string" || !id.startsWith(DAILY_PREFIX)) return null;
  const day = id.slice(DAILY_PREFIX.length);
  return isDay(day) ? day : null;
}

// --- Jours ---

const pad = (value: number) => String(value).padStart(2, "0");

/** Date locale de l'appareil, au format AAAA-MM-JJ. */
export const dayOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date;
}

/** Le jour précédent, sans dépendre du fuseau ni du changement d'heure. */
export function previousDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const previous = new Date(Date.UTC(year, month - 1, date - 1));
  return `${previous.getUTCFullYear()}-${pad(previous.getUTCMonth() + 1)}-${pad(previous.getUTCDate())}`;
}

// --- Banques : toutes les questions publiées, aucune n'est écrite pour ces défis. ---

export type NationalTerritory = Pick<Territory, "id" | "status" | "regionId" | "levels">;

export interface NationalBank extends QuestionBank {
  id: string;
  questions: LevelChallenge[];
}

/** Même forme d'id que le Mode Famille : une question garde son territoire, deux territoires ne se confondent jamais. */
const pooledId = (territoryId: string, id: string) => `${territoryId}/${id}`;

function poolOf(
  territories: readonly NationalTerritory[],
  id: string,
  format: ChallengeFormat,
  options: { categories?: ReadonlySet<string>; oneQuestionPerRegion?: boolean } = {},
): NationalBank {
  const questions: LevelChallenge[] = [];
  for (const territory of territories) {
    if (territory.status !== "published") continue;
    for (const level of territory.levels) {
      for (const question of level.questions) {
        if (options.categories && !options.categories.has(question.category)) continue;
        questions.push({
          ...question,
          id: pooledId(territory.id, question.id),
          // Un groupe ne sort qu'une fois par partie : grouper par région donne une question au plus par région.
          group: options.oneQuestionPerRegion ? `region:${territory.regionId}` : pooledId(territory.id, question.group ?? `id:${question.id}`),
        });
      }
    }
  }
  return { id, minDifficulty: format.minDifficulty, maxDifficulty: format.maxDifficulty, questions };
}

/** Territoires dont la région est jouable avec les droits du joueur. */
export const accessibleTerritories = <T extends NationalTerritory>(territories: readonly T[], canPlayRegion: (regionId: string) => boolean): T[] =>
  territories.filter((territory) => territory.status === "published" && canPlayRegion(territory.regionId));

export const dailyBank = (territories: readonly NationalTerritory[], day: string): NationalBank =>
  poolOf(territories, dailyBankId(day), DAILY_RULES);

export const franceBank = (territories: readonly NationalTerritory[]): NationalBank =>
  poolOf(territories, FRANCE_KEY, FRANCE_RULES, { oneQuestionPerRegion: true });

export const themeBank = (territories: readonly NationalTerritory[], theme: FamilyTheme, access: ThemeAccess): NationalBank =>
  poolOf(territories, themeKey(theme.id, access), THEME_RULES, { categories: new Set(theme.categories) });

/** Sans assez de questions différentes, le défi n'est pas proposé : il ne s'en invente jamais. */
export const isBankPlayable = (bank: QuestionBank, format: ChallengeFormat): boolean =>
  questionsPerRunOf(bank, format.questions) === format.questions;

// --- Tirages ---

/** Mêmes droits, même jour : même tirage pour tous les joueurs. L'historique du joueur n'y entre pas. */
export function drawDaily(bank: NationalBank, day: string): string[] {
  const regions = [...new Set(bank.questions.map((question) => question.id.split("/")[0]))].sort().join(",");
  return selectQuestions(bank, EMPTY_HISTORY, seededRandom(`${day}|${regions}`), DAILY_RULES.questions, { coverCategories: DAILY_RULES.coverCategories });
}

/** Défi de France et Défis thématiques : questions récentes évitées, thèmes représentés, comme le Défi Maître. */
export const drawNational = (bank: NationalBank, format: ChallengeFormat, history: QuestionHistory, random: RandomSource): string[] =>
  selectQuestions(bank, history, random, format.questions, { coverCategories: format.coverCategories });

// --- Défi du jour : résultats, série, XP ---

export interface DailyRecord {
  correct: number;
  /** XP gagné ce jour-là, écrit une fois. */
  xp: number;
  /** Date ISO de la fin de la partie. */
  finishedAt: string;
}

export type DailyRecords = Readonly<Record<string, DailyRecord | undefined>>;

/**
 * Ajoute le résultat d'un jour. Un jour déjà enregistré ne change jamais : une reprise, un second onglet
 * ou une partie gardée du même jour ne rapportent rien de plus.
 */
export function withDailyResult(
  records: DailyRecords,
  day: string,
  correct: number,
  finishedAt: string,
): { records: DailyRecords; record: DailyRecord; added: boolean } {
  const existing = records[day];
  if (existing) return { records, record: existing, added: false };
  const record: DailyRecord = { correct, xp: dailyXp(correct), finishedAt };
  return { records: { ...records, [day]: record }, record, added: true };
}

export const dailyXpTotal = (records: DailyRecords): number =>
  Object.values(records).reduce((total, record) => total + (record?.xp ?? 0), 0);

export interface DailyStreak {
  /** Jours consécutifs jusqu'à aujourd'hui, ou jusqu'à hier si aujourd'hui n'est pas encore terminé. */
  current: number;
  best: number;
}

export function dailyStreak(records: DailyRecords, today: string): DailyStreak {
  const days = new Set(Object.keys(records).filter((day) => isDay(day) && records[day] !== undefined));
  let current = 0;
  let day = days.has(today) ? today : previousDay(today);
  while (days.has(day)) {
    current += 1;
    day = previousDay(day);
  }
  let best = 0;
  for (const start of days) {
    // Une série se compte depuis son premier jour.
    if (days.has(previousDay(start))) continue;
    let length = 0;
    let next = start;
    while (days.has(next)) {
      length += 1;
      next = nextDay(next);
    }
    best = Math.max(best, length);
  }
  return { current, best: Math.max(best, current) };
}

function nextDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

// --- Badges nationaux : ils se déduisent du résultat du défi complet, rien n'est stocké à part. ---

export interface NationalBadge {
  id: string;
  kind: "country" | "theme";
  /** Clé du résultat qui donne le badge. */
  challengeKey: string;
  themeId?: string;
  nameKey: string;
  descriptionKey: string;
}

/** Un badge national et un par thème du pays. Textes dans les traductions de contenu du pays. */
export function nationalBadges(themes: readonly FamilyTheme[]): NationalBadge[] {
  return [
    {
      id: FRANCE_KEY,
      kind: "country",
      challengeKey: FRANCE_KEY,
      nameKey: "nationalChallenges.badges.france.name",
      descriptionKey: "nationalChallenges.badges.france.description",
    },
    ...themes.map(
      (theme): NationalBadge => ({
        id: themeKey(theme.id, "full"),
        kind: "theme",
        challengeKey: themeKey(theme.id, "full"),
        themeId: theme.id,
        nameKey: `nationalChallenges.badges.themes.${theme.id}.name`,
        descriptionKey: `nationalChallenges.badges.themes.${theme.id}.description`,
      }),
    ),
  ];
}

export const isNationalBadgeEarned = (badge: NationalBadge, challenges: ChallengeRecords): boolean =>
  challenges[badge.challengeKey]?.passed === true;

/** Ce qu'un nouveau résultat vient de faire gagner : rien lors d'un rejeu. */
export const newNationalBadges = (badges: readonly NationalBadge[], before: ChallengeRecords, after: ChallengeRecords): NationalBadge[] =>
  badges.filter((badge) => !isNationalBadgeEarned(badge, before) && isNationalBadgeEarned(badge, after));

/** Toutes les clés de résultat des défis nationaux d'un pays, pour la réinitialisation. */
export const nationalChallengeKeys = (themes: readonly FamilyTheme[]): string[] => [
  FRANCE_KEY,
  ...themes.flatMap((theme) => [themeKey(theme.id, "full"), themeKey(theme.id, "discovery")]),
];
