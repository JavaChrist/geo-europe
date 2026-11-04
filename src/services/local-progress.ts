import type { ChallengeResult, StarCount } from "@/engine/level-run";
import { applyReset, type ResetTargets } from "@/engine/progress-reset";
import { xpAfterRun } from "@/engine/progress-summary";
import { EMPTY_HISTORY, type QuestionHistory, withRunResults } from "@/engine/question-selection";
import { type ChallengePerformance, type ChallengeRecord, type SpecialChallengeRules, withChallengeResult } from "@/engine/special-challenges";
import { AppError } from "./app-error";

/**
 * Résultats réels enregistrés dans le stockage local de l'appareil, et nulle part ailleurs.
 * Il n'existe pas encore de profils : tout va dans un espace unique, « cet appareil ».
 * Un profil local deviendra un espace de plus, avec ses résultats et son historique, sans changer le format.
 */
const FORMAT_VERSION = 1;
const DEVICE_SPACE = "device";

export interface LevelRecord {
  bestScore: number;
  /** Étoiles selon le barème du jour de la partie. L'affichage les recalcule depuis `bestScore`. */
  bestStars: StarCount;
  lastScore: number;
  lastStars: StarCount;
  plays: number;
  /** Date ISO de la dernière partie terminée. */
  lastPlayedAt: string;
  /** XP cumulés sur ce niveau, seul total impossible à recalculer. Absent des résultats enregistrés avant son arrivée. */
  xp?: number;
}

export type LevelRecords = Record<string, LevelRecord>;

interface StoredSpace {
  levels: LevelRecords;
  /** Absent des données enregistrées avant l'arrivée de la banque de questions. */
  questions?: Record<string, QuestionHistory>;
  /** Défis spéciaux, à part des niveaux : ils n'entrent ni dans les compteurs régionaux ni dans l'XP. */
  challenges?: Record<string, ChallengeRecord>;
}

interface StoredProgress {
  version: number;
  spaces: Record<string, StoredSpace>;
}

const NO_RECORDS: LevelRecords = {};
const NO_CHALLENGES: Record<string, ChallengeRecord> = {};

const storageKey = (countryCode: string) => `geo-europe.${countryCode}.progress`;

const isStars = (value: unknown): value is StarCount => value === 0 || value === 1 || value === 2 || value === 3;
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function isLevelRecord(value: unknown): value is LevelRecord {
  if (!isObject(value)) return false;
  const record = value as Partial<LevelRecord>;
  return (
    isCount(record.bestScore) &&
    isStars(record.bestStars) &&
    isCount(record.lastScore) &&
    isStars(record.lastStars) &&
    isCount(record.plays) &&
    typeof record.lastPlayedAt === "string" &&
    (record.xp === undefined || isCount(record.xp))
  );
}

function isChallengeRecord(value: unknown): value is ChallengeRecord {
  if (!isObject(value)) return false;
  const record = value as Partial<ChallengeRecord>;
  return (
    isCount(record.plays) &&
    isCount(record.lastCorrect) &&
    typeof record.lastPlayedAt === "string" &&
    isCount(record.bestCorrect) &&
    (record.bestTimeMs === null || isCount(record.bestTimeMs)) &&
    typeof record.passed === "boolean"
  );
}

function isQuestionHistory(value: unknown): value is QuestionHistory {
  if (!isObject(value) || !isCount(value.plays) || !isObject(value.questions)) return false;
  return Object.values(value.questions).every(
    (memory) => isObject(memory) && isCount(memory.lastPlay) && typeof memory.missed === "boolean",
  );
}

/** Une donnée illisible ou modifiée à la main est ignorée, jamais présentée comme une progression. */
function parseStored(raw: string | null): Partial<StoredProgress> | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredProgress>;
    return isObject(stored) && stored.version === FORMAT_VERSION ? stored : null;
  } catch {
    return null;
  }
}

function parseRecords(raw: string | null): LevelRecords {
  const levels = parseStored(raw)?.spaces?.[DEVICE_SPACE]?.levels;
  if (!levels) return NO_RECORDS;
  return Object.fromEntries(Object.entries(levels).filter(([, record]) => isLevelRecord(record)));
}

function parseChallenges(raw: string | null): Record<string, ChallengeRecord> {
  const challenges = parseStored(raw)?.spaces?.[DEVICE_SPACE]?.challenges;
  if (!challenges) return NO_CHALLENGES;
  return Object.fromEntries(Object.entries(challenges).filter(([, record]) => isChallengeRecord(record)));
}

let cache: { key: string; raw: string | null; records: LevelRecords } | null = null;
let challengeCache: { key: string; raw: string | null; records: Record<string, ChallengeRecord> } | null = null;
const listeners = new Set<() => void>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Rend le même objet tant que le stockage ne change pas, comme l'attend useSyncExternalStore. */
export function readLevelRecords(countryCode: string): LevelRecords {
  const key = storageKey(countryCode);
  const raw = readRaw(key);
  if (cache?.key !== key || cache.raw !== raw) cache = { key, raw, records: parseRecords(raw) };
  return cache.records;
}

/** Même garantie que readLevelRecords, pour les défis spéciaux. */
export function readChallengeRecords(countryCode: string): Record<string, ChallengeRecord> {
  const key = storageKey(countryCode);
  const raw = readRaw(key);
  if (challengeCache?.key !== key || challengeCache.raw !== raw) challengeCache = { key, raw, records: parseChallenges(raw) };
  return challengeCache.records;
}

/** Sans stockage disponible, l'historique est vide : le tirage fonctionne quand même. */
export function readQuestionHistory(countryCode: string, levelId: string): QuestionHistory {
  const history = parseStored(readRaw(storageKey(countryCode)))?.spaces?.[DEVICE_SPACE]?.questions?.[levelId];
  return isQuestionHistory(history) ? history : EMPTY_HISTORY;
}

export function subscribeToLevelRecords(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const notify = () => listeners.forEach((listener) => listener());

const withHistory = (countryCode: string, historyKey: string, results: readonly ChallengeResult[]) => ({
  ...parseStored(readRaw(storageKey(countryCode)))?.spaces?.[DEVICE_SPACE]?.questions,
  [historyKey]: withRunResults(readQuestionHistory(countryCode, historyKey), results),
});

function writeSpace(countryCode: string, space: StoredSpace): void {
  const key = storageKey(countryCode);
  const stored: StoredProgress = {
    version: FORMAT_VERSION,
    spaces: { ...parseStored(readRaw(key))?.spaces, [DEVICE_SPACE]: space },
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(stored));
  } catch (cause) {
    throw new AppError("storage", { cause });
  }
  notify();
}

export function recordLevelResult(
  countryCode: string,
  levelId: string,
  score: number,
  stars: StarCount,
  results: readonly ChallengeResult[],
): LevelRecord {
  const previous = readLevelRecords(countryCode)[levelId];
  const record: LevelRecord = {
    bestScore: Math.max(score, previous?.bestScore ?? 0),
    bestStars: Math.max(stars, previous?.bestStars ?? 0) as StarCount,
    lastScore: score,
    lastStars: stars,
    plays: (previous?.plays ?? 0) + 1,
    lastPlayedAt: new Date().toISOString(),
    xp: xpAfterRun(previous, score),
  };
  writeSpace(countryCode, {
    levels: { ...readLevelRecords(countryCode), [levelId]: record },
    questions: withHistory(countryCode, levelId, results),
    challenges: readChallengeRecords(countryCode),
  });
  return record;
}

export function recordChallengeResult(
  countryCode: string,
  challengeKey: string,
  rules: SpecialChallengeRules,
  performance: ChallengePerformance,
  results: readonly ChallengeResult[],
): ChallengeRecord {
  const challenges = readChallengeRecords(countryCode);
  const record = withChallengeResult(challenges[challengeKey], rules, performance, new Date().toISOString());
  writeSpace(countryCode, {
    levels: readLevelRecords(countryCode),
    questions: withHistory(countryCode, challengeKey, results),
    challenges: { ...challenges, [challengeKey]: record },
  });
  return record;
}

/**
 * Efface une partie de l'espace actif et rien d'autre : les autres espaces restent intacts.
 * Lève une erreur si l'écriture échoue : le joueur n'est averti d'une réussite qu'après coup.
 */
export function resetProgress(countryCode: string, targets: ResetTargets): void {
  const space = parseStored(readRaw(storageKey(countryCode)))?.spaces?.[DEVICE_SPACE];
  writeSpace(
    countryCode,
    applyReset({ levels: space?.levels ?? {}, questions: space?.questions ?? {}, challenges: space?.challenges ?? {} }, targets),
  );
}

/** Efface tout ce que l'appareil garde pour ce pays, tous espaces confondus : réservé à la suppression des données de l'appareil. */
export function clearLevelRecords(countryCode: string): void {
  try {
    window.localStorage.removeItem(storageKey(countryCode));
  } catch (cause) {
    throw new AppError("storage", { cause });
  }
  notify();
}
