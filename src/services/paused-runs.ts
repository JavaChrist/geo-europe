/**
 * Parties de niveau et de défi spécial en cours, gardées sur l'appareil à chaque étape.
 * Elles survivent à une sortie confirmée, à l'application mise en arrière-plan puis fermée par Android, ou à un rechargement.
 * Le contenu est validé par le moteur (`isRunResumable`) avant toute reprise : ce service ne fait que lire et écrire.
 */

const FORMAT_VERSION = 1;
const storageKey = (countryCode: string) => `geo-europe.${countryCode}.paused-runs`;

/** Chronomètre d'un défi limité dans le temps, en temps d'horloge : `performance.now()` repart de zéro au rechargement. */
export interface PausedTimer {
  /** Heure de départ, en millisecondes depuis l'époque. */
  startedAt: number;
  /** Temps écoulé au moment de la sauvegarde : une horloge reculée ne rend jamais ce temps. */
  elapsedMs: number;
  /** Temps figé à la dernière réponse, `null` tant que la partie court. */
  stoppedMs: number | null;
}

export interface PausedRun {
  /** À valider par le moteur avant usage. */
  run: unknown;
  timer: PausedTimer | null;
}

type PausedRuns = Record<string, PausedRun>;

const NONE: PausedRuns = {};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function isTimer(value: unknown): value is PausedTimer {
  return isObject(value) && isNumber(value.startedAt) && isNumber(value.elapsedMs) && (value.stoppedMs === null || isNumber(value.stoppedMs));
}

function parse(raw: string | null): PausedRuns {
  if (!raw) return NONE;
  try {
    const stored: unknown = JSON.parse(raw);
    if (!isObject(stored) || stored.version !== FORMAT_VERSION || !isObject(stored.runs)) return NONE;
    return Object.fromEntries(
      Object.entries(stored.runs).filter(
        (entry): entry is [string, PausedRun] => isObject(entry[1]) && "run" in entry[1] && (entry[1].timer === null || isTimer(entry[1].timer)),
      ),
    );
  } catch {
    return NONE;
  }
}

let cache: { key: string; raw: string | null; runs: PausedRuns } | null = null;
const listeners = new Set<() => void>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readAll(countryCode: string): PausedRuns {
  const key = storageKey(countryCode);
  const raw = readRaw(key);
  if (cache?.key !== key || cache.raw !== raw) cache = { key, raw, runs: parse(raw) };
  return cache.runs;
}

/** Rend le même objet tant que le stockage ne change pas, comme l'attend useSyncExternalStore. */
export function readPausedRun(countryCode: string, runKey: string): PausedRun | null {
  return readAll(countryCode)[runKey] ?? null;
}

export function subscribeToPausedRuns(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Sans stockage disponible, la partie continue normalement : elle ne sera simplement pas reprenable.
 * Aucune erreur n'est montrée pour ne pas interrompre le jeu à chaque réponse.
 */
function write(countryCode: string, runs: PausedRuns): void {
  try {
    if (Object.keys(runs).length === 0) window.localStorage.removeItem(storageKey(countryCode));
    else window.localStorage.setItem(storageKey(countryCode), JSON.stringify({ version: FORMAT_VERSION, runs }));
  } catch {
    return;
  }
  listeners.forEach((listener) => listener());
}

export function savePausedRun(countryCode: string, runKey: string, paused: PausedRun): void {
  write(countryCode, { ...readAll(countryCode), [runKey]: paused });
}

/** À appeler avant d'enregistrer le résultat : une partie terminée ne peut plus être reprise, donc rien ne se gagne deux fois. */
export function clearPausedRun(countryCode: string, runKey: string): void {
  const { [runKey]: _removed, ...others } = readAll(countryCode);
  if (_removed) write(countryCode, others);
}
