import {
  FAMILY_COLORS,
  FAMILY_DURATIONS,
  FAMILY_RULES,
  type FamilyColor,
  type FamilyDuration,
  type FamilyGame,
  type FamilyPlayer,
  type FamilyScope,
  familyStandings,
  gameQuestions,
} from "@/engine/family";
import { AppError } from "./app-error";

/**
 * Mode Famille, sur cet appareil seulement : joueurs, parties terminées, partie en cours.
 * À part de la progression Solo : rien ici ne donne d'XP, de carte souvenir ni de record.
 */
const FORMAT_VERSION = 1;

export interface FamilyHistoryRow {
  playerId: string;
  name: string;
  color: FamilyColor;
  points: number;
  correct: number;
  hints: number;
  jokers: number;
  rank: number;
}

export interface FamilyHistoryEntry {
  id: string;
  scope: FamilyScope;
  duration: FamilyDuration;
  finishedAt: string;
  standings: FamilyHistoryRow[];
}

export interface FamilyData {
  players: FamilyPlayer[];
  /** Parties terminées, la plus récente en tête. */
  history: FamilyHistoryEntry[];
  /** Partie à reprendre après un rechargement, `null` sans partie en cours. */
  current: FamilyGame | null;
  /** Questions des dernières parties, tirées en dernier. */
  recent: string[][];
}

const EMPTY: FamilyData = { players: [], history: [], current: null, recent: [] };

const storageKey = (countryCode: string) => `geo-europe.${countryCode}.family`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isColor = (value: unknown): value is FamilyColor => FAMILY_COLORS.includes(value as FamilyColor);
const isDuration = (value: unknown): value is FamilyDuration => FAMILY_DURATIONS.includes(value as FamilyDuration);

function isScope(value: unknown): value is FamilyScope {
  if (!isObject(value)) return false;
  if (value.kind === "country") return true;
  if (value.kind === "territory") return isText(value.territoryId);
  return value.kind === "theme" && isText(value.themeId);
}

const isPlayer = (value: unknown): value is FamilyPlayer =>
  isObject(value) && isText(value.id) && isText(value.name) && value.name.length <= FAMILY_RULES.maxNameLength && isColor(value.color);

const isHistoryRow = (value: unknown): value is FamilyHistoryRow =>
  isObject(value) &&
  isText(value.playerId) &&
  isText(value.name) &&
  isColor(value.color) &&
  [value.points, value.correct, value.hints, value.jokers, value.rank].every(isCount);

const isHistoryEntry = (value: unknown): value is FamilyHistoryEntry =>
  isObject(value) &&
  isText(value.id) &&
  isScope(value.scope) &&
  isDuration(value.duration) &&
  isText(value.finishedAt) &&
  Array.isArray(value.standings) &&
  value.standings.every(isHistoryRow);

const isTurn = (value: unknown): boolean =>
  isObject(value) &&
  isCount(value.round) &&
  isText(value.playerId) &&
  isText(value.challengeId) &&
  typeof value.correct === "boolean" &&
  isCount(value.attempts) &&
  typeof value.jokerUsed === "boolean" &&
  isCount(value.points);

/** Une partie illisible ou modifiée à la main n'est pas reprise : elle est oubliée. */
function isGame(value: unknown): value is FamilyGame {
  if (!isObject(value)) return false;
  const { players, plan, round, turn, phase, run, turns } = value;
  if (!isText(value.id) || !isScope(value.scope) || !isDuration(value.duration) || !isText(value.startedAt)) return false;
  if (value.finishedAt !== null) return false;
  if (!Array.isArray(players) || players.length < FAMILY_RULES.minPlayers || players.length > FAMILY_RULES.maxPlayers) return false;
  if (!players.every((player: unknown) => isPlayer(player) && isCount((player as unknown as Record<string, unknown>).jokersLeft))) return false;
  // Une partie d'avant le tour à plusieurs questions n'a pas la même forme : elle n'est pas reprise.
  const duration = value.duration as FamilyDuration;
  const perTurn = FAMILY_RULES.questionsPerTurn[duration];
  if (!Array.isArray(plan) || plan.length !== FAMILY_RULES.rounds[duration]) return false;
  if (!plan.every((lists) => Array.isArray(lists) && lists.length === players.length && lists.every((ids) => isStrings(ids) && ids.length === perTurn))) {
    return false;
  }
  if (!isCount(round) || round >= plan.length || !isCount(turn) || turn >= players.length) return false;
  // Le classement de manche arrive après le tour du dernier joueur, qui est déjà compté.
  const played = (round * players.length + turn + (phase === "summary" ? 1 : 0)) * perTurn;
  if (!Array.isArray(turns) || turns.length !== played || !turns.every(isTurn)) return false;
  if (phase === "playing") {
    return (
      isObject(run) &&
      isStrings(run.challengeIds) &&
      run.challengeIds.length === perTurn &&
      isStrings(run.answerOrder) &&
      isStrings(run.tried) &&
      isStrings(run.removed) &&
      [run.index, run.jokersLeft, run.maxAttempts].every(isCount) &&
      typeof run.jokerUsed === "boolean" &&
      ["playing", "correct", "failed"].includes(run.state as string) &&
      Array.isArray(run.results)
    );
  }
  return (phase === "handoff" || phase === "summary") && run === null;
}

function parse(raw: string | null): FamilyData {
  if (!raw) return EMPTY;
  try {
    const stored = JSON.parse(raw) as Record<string, unknown>;
    if (!isObject(stored) || stored.version !== FORMAT_VERSION) return EMPTY;
    return {
      players: Array.isArray(stored.players) ? stored.players.filter(isPlayer).slice(0, 50) : [],
      history: Array.isArray(stored.history) ? stored.history.filter(isHistoryEntry).slice(0, FAMILY_RULES.historyLimit) : [],
      current: isGame(stored.current) ? stored.current : null,
      recent: Array.isArray(stored.recent) ? stored.recent.filter(isStrings).slice(0, FAMILY_RULES.recentGamesAvoided) : [],
    };
  } catch {
    return EMPTY;
  }
}

let cache: { key: string; raw: string | null; data: FamilyData } | null = null;
const listeners = new Set<() => void>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Rend le même objet tant que le stockage ne change pas, comme l'attend useSyncExternalStore. */
export function readFamilyData(countryCode: string): FamilyData {
  const key = storageKey(countryCode);
  const raw = readRaw(key);
  if (cache?.key !== key || cache.raw !== raw) cache = { key, raw, data: parse(raw) };
  return cache.data;
}

export const EMPTY_FAMILY_DATA = EMPTY;

export function subscribeToFamilyData(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function write(countryCode: string, data: FamilyData): void {
  try {
    window.localStorage.setItem(storageKey(countryCode), JSON.stringify({ version: FORMAT_VERSION, ...data }));
  } catch (cause) {
    throw new AppError("storage", { cause });
  }
  listeners.forEach((listener) => listener());
}

const update = (countryCode: string, change: (data: FamilyData) => Partial<FamilyData>) => {
  const data = readFamilyData(countryCode);
  write(countryCode, { ...data, ...change(data) });
};

/** Ajoute ou met à jour des joueurs, sans toucher aux autres. */
export function saveFamilyPlayers(countryCode: string, players: readonly FamilyPlayer[]): void {
  update(countryCode, (data) => ({
    players: [...data.players.filter((saved) => !players.some((player) => player.id === saved.id)), ...players],
  }));
}

export function removeFamilyPlayer(countryCode: string, playerId: string): void {
  update(countryCode, (data) => ({ players: data.players.filter((player) => player.id !== playerId) }));
}

/** Garde la partie en cours, à chaque étape, pour la reprendre après un rechargement. */
export function saveFamilyGame(countryCode: string, game: FamilyGame | null): void {
  update(countryCode, () => ({ current: game }));
}

/** Range une partie terminée dans l'historique et libère la partie en cours. */
export function recordFamilyGame(countryCode: string, game: FamilyGame): FamilyHistoryEntry {
  const entry: FamilyHistoryEntry = {
    id: game.id,
    scope: game.scope,
    duration: game.duration,
    finishedAt: game.finishedAt ?? new Date().toISOString(),
    standings: familyStandings(game).map((row) => ({
      playerId: row.player.id,
      name: row.player.name,
      color: row.player.color,
      points: row.points,
      correct: row.correct,
      hints: row.hints,
      jokers: row.jokers,
      rank: row.rank,
    })),
  };
  update(countryCode, (data) => ({
    current: null,
    history: [entry, ...data.history.filter((row) => row.id !== entry.id)].slice(0, FAMILY_RULES.historyLimit),
    recent: [gameQuestions(game), ...data.recent].slice(0, FAMILY_RULES.recentGamesAvoided),
  }));
  return entry;
}

/** Efface tout le Mode Famille de cet appareil. */
export function clearFamilyData(countryCode: string): void {
  try {
    window.localStorage.removeItem(storageKey(countryCode));
  } catch (cause) {
    throw new AppError("storage", { cause });
  }
  listeners.forEach((listener) => listener());
}
