import type { StarCount } from "@/engine/level-run";
import { AppError } from "./app-error";

/**
 * Résultats réels enregistrés dans le stockage local de l'appareil, et nulle part ailleurs.
 * Il n'existe pas encore de profils : tout va dans un espace unique, « cet appareil ».
 * Un profil local deviendra un espace de plus, sans changer le format.
 */
const FORMAT_VERSION = 1;
const DEVICE_SPACE = "device";

export interface LevelRecord {
  bestScore: number;
  bestStars: StarCount;
  lastScore: number;
  lastStars: StarCount;
  plays: number;
  /** Date ISO de la dernière partie terminée. */
  lastPlayedAt: string;
}

export type LevelRecords = Record<string, LevelRecord>;

interface StoredProgress {
  version: number;
  spaces: Record<string, { levels: LevelRecords }>;
}

const NO_RECORDS: LevelRecords = {};

const storageKey = (countryCode: string) => `geo-europe.${countryCode}.progress`;

const isStars = (value: unknown): value is StarCount => value === 0 || value === 1 || value === 2 || value === 3;
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

function isLevelRecord(value: unknown): value is LevelRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<LevelRecord>;
  return (
    isCount(record.bestScore) &&
    isStars(record.bestStars) &&
    isCount(record.lastScore) &&
    isStars(record.lastStars) &&
    isCount(record.plays) &&
    typeof record.lastPlayedAt === "string"
  );
}

/** Une donnée illisible ou modifiée à la main est ignorée, jamais présentée comme une progression. */
function parseRecords(raw: string | null): LevelRecords {
  if (!raw) return NO_RECORDS;
  try {
    const stored = JSON.parse(raw) as Partial<StoredProgress>;
    if (stored.version !== FORMAT_VERSION) return NO_RECORDS;
    const levels = stored.spaces?.[DEVICE_SPACE]?.levels ?? {};
    return Object.fromEntries(Object.entries(levels).filter(([, record]) => isLevelRecord(record)));
  } catch {
    return NO_RECORDS;
  }
}

let cache: { key: string; raw: string | null; records: LevelRecords } | null = null;
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

export function subscribeToLevelRecords(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const notify = () => listeners.forEach((listener) => listener());

export function recordLevelResult(countryCode: string, levelId: string, score: number, stars: StarCount): LevelRecord {
  const previous = readLevelRecords(countryCode)[levelId];
  const record: LevelRecord = {
    bestScore: Math.max(score, previous?.bestScore ?? 0),
    bestStars: Math.max(stars, previous?.bestStars ?? 0) as StarCount,
    lastScore: score,
    lastStars: stars,
    plays: (previous?.plays ?? 0) + 1,
    lastPlayedAt: new Date().toISOString(),
  };
  const levels = { ...readLevelRecords(countryCode), [levelId]: record };
  const stored: StoredProgress = { version: FORMAT_VERSION, spaces: { [DEVICE_SPACE]: { levels } } };
  try {
    window.localStorage.setItem(storageKey(countryCode), JSON.stringify(stored));
  } catch (cause) {
    throw new AppError("storage", { cause });
  }
  notify();
  return record;
}

export function clearLevelRecords(countryCode: string): void {
  try {
    window.localStorage.removeItem(storageKey(countryCode));
  } catch (cause) {
    throw new AppError("storage", { cause });
  }
  notify();
}
