/**
 * Mode Famille : plusieurs joueurs, un seul appareil, chacun son tour.
 * Aucun pays, aucune langue, aucun stockage ici : le contenu arrive en paramètre, toute action rend un nouvel état.
 * Chaque tour est une partie d'une question jouée avec le moteur des niveaux (level-run.ts).
 */
import {
  applyJoker,
  type ChallengeResult,
  type LevelRun,
  type RunBank,
  startRun,
  submitAnswer,
} from "./level-run.ts";
import { type RandomSource, shuffled } from "./random.ts";
import type { FamilyTheme, LevelChallenge, QuestionDifficulty, Territory } from "./types.ts";

export type { FamilyTheme };

export type FamilyDuration = "quick" | "classic" | "long";

/** Toutes les valeurs du mode, au même endroit. */
export const FAMILY_RULES = {
  minPlayers: 2,
  maxPlayers: 4,
  maxNameLength: 16,
  /** Une manche : un tour par joueur. */
  rounds: { quick: 3, classic: 5, long: 10 } satisfies Record<FamilyDuration, number>,
  defaultDuration: "classic" as FamilyDuration,
  /** Jokers 50/50 de chaque joueur pour toute la partie. */
  jokers: { quick: 1, classic: 2, long: 3 } satisfies Record<FamilyDuration, number>,
  /** Deux essais : l'indice s'affiche après la première erreur. */
  maxAttempts: 2,
  points: { clean: 10, hint: 7, joker: 5, wrong: 0 },
  /** Les questions des N dernières parties terminées ne reviennent que si la réserve manque. */
  recentGamesAvoided: 3,
  /** Parties gardées dans l'historique. */
  historyLimit: 20,
} as const;

export const FAMILY_DURATIONS: readonly FamilyDuration[] = ["quick", "classic", "long"];

/** Couleurs d'avatar, nommées : leur rendu appartient à l'interface. */
export const FAMILY_COLORS = ["gold", "sky", "rose", "emerald", "violet", "orange"] as const;
export type FamilyColor = (typeof FAMILY_COLORS)[number];

export interface FamilyPlayer {
  id: string;
  name: string;
  color: FamilyColor;
}


export type FamilyScope = { kind: "country" } | { kind: "territory"; territoryId: string } | { kind: "theme"; themeId: string };

export const scopeKey = (scope: FamilyScope): string =>
  scope.kind === "country" ? "country" : scope.kind === "territory" ? `territory:${scope.territoryId}` : `theme:${scope.themeId}`;

/** Les ids de questions ne sont uniques que dans un territoire : la réserve Famille les préfixe. */
const SEPARATOR = "/";
export const poolQuestionId = (territoryId: string, questionId: string) => `${territoryId}${SEPARATOR}${questionId}`;

type PoolTerritory = Pick<Territory, "id" | "status" | "levels">;

/**
 * Questions des territoires publiés, dans le périmètre choisi. Rien n'est inventé ni réécrit :
 * seuls l'id et le groupe anti-fuite sont préfixés par le territoire.
 */
export function familyPool(territories: readonly PoolTerritory[], scope: FamilyScope, themes: readonly FamilyTheme[]): RunBank {
  const categories = scope.kind === "theme" ? new Set(themes.find((theme) => theme.id === scope.themeId)?.categories ?? []) : null;
  const questions: LevelChallenge[] = [];
  for (const territory of territories) {
    if (territory.status !== "published") continue;
    if (scope.kind === "territory" && territory.id !== scope.territoryId) continue;
    for (const level of territory.levels) {
      for (const question of level.questions) {
        if (categories && !categories.has(question.category)) continue;
        questions.push({
          ...question,
          id: poolQuestionId(territory.id, question.id),
          group: poolQuestionId(territory.id, question.group ?? `id:${question.id}`),
        });
      }
    }
  }
  return { id: `family:${scopeKey(scope)}`, questions };
}

/** Difficulté visée à chaque manche : elle monte au fil de la partie. */
export function roundDifficulties(rounds: number, available: readonly QuestionDifficulty[]): QuestionDifficulty[] {
  const levels = [...new Set(available)].sort((a, b) => a - b);
  if (levels.length === 0) return [];
  return Array.from({ length: rounds }, (_, round) => levels[Math.floor((round * levels.length) / rounds)] as QuestionDifficulty);
}

/**
 * Tire les questions de toute la partie : `plan[manche][joueur]`.
 * Dans une manche, tous les joueurs ont la même difficulté, et le même type de question quand la réserve le permet.
 * Aucune question ni aucun groupe anti-fuite ne sert deux fois. Les questions de `avoid` ne servent qu'en dernier recours.
 * Rend `null` si la réserve ne suffit pas : le mode ne s'invente jamais de question.
 */
export function planFamilyGame(
  bank: RunBank,
  players: number,
  rounds: number,
  random: RandomSource,
  avoid: ReadonlySet<string> = new Set(),
): string[][] | null {
  const usedGroups = new Set<string>();
  const groupOf = (question: LevelChallenge) => question.group ?? question.id;
  // Les questions récentes passent derrière, l'ordre reste aléatoire à rang égal.
  const ranked = shuffled(bank.questions, random).sort((a, b) => Number(avoid.has(a.id)) - Number(avoid.has(b.id)));
  const targets = roundDifficulties(rounds, ranked.map((question) => question.difficulty));
  if (targets.length === 0) return null;

  const pickRound = (candidates: LevelChallenge[]): LevelChallenge[] | null => {
    const picked: LevelChallenge[] = [];
    // Thèmes variés dans la manche d'abord, puis n'importe quel thème.
    for (const varied of [true, false]) {
      for (const question of candidates) {
        if (picked.length === players) break;
        if (picked.includes(question) || picked.some((other) => groupOf(other) === groupOf(question))) continue;
        if (varied && picked.some((other) => other.category === question.category)) continue;
        picked.push(question);
      }
    }
    return picked.length === players ? picked : null;
  };

  const plan: string[][] = [];
  for (const target of targets) {
    // La difficulté visée d'abord, puis la plus proche : tous les joueurs d'une manche restent à égalité.
    const difficulties = ([1, 2, 3] as QuestionDifficulty[]).sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || b - a);
    let round: LevelChallenge[] | null = null;
    for (const difficulty of difficulties) {
      const free = ranked.filter((question) => question.difficulty === difficulty && !usedGroups.has(groupOf(question)));
      const kinds = shuffled([...new Set(free.map((question) => question.kind))], random);
      for (const kind of kinds) {
        round = pickRound(free.filter((question) => question.kind === kind));
        if (round) break;
      }
      round ??= pickRound(free);
      if (round) break;
    }
    if (!round) return null;
    for (const question of round) usedGroups.add(groupOf(question));
    plan.push(round.map((question) => question.id));
  }
  return plan;
}

/** Durées jouables avec cette réserve et ce nombre de joueurs. */
export const playableDurations = (bank: RunBank, players: number, random: RandomSource): FamilyDuration[] =>
  FAMILY_DURATIONS.filter((duration) => planFamilyGame(bank, players, FAMILY_RULES.rounds[duration], random) !== null);

/** Barème : sans aide, avec l'indice (deuxième essai), avec le 50/50. Plusieurs aides : la valeur la plus basse. */
export function familyPointsFor(result: Pick<ChallengeResult, "correct" | "attempts" | "jokerUsed">): number {
  const { clean, hint, joker, wrong } = FAMILY_RULES.points;
  if (!result.correct) return wrong;
  const values: number[] = [clean];
  if (result.attempts > 1) values.push(hint);
  if (result.jokerUsed) values.push(joker);
  return Math.min(...values);
}

export interface FamilyTurn {
  round: number;
  playerId: string;
  challengeId: string;
  correct: boolean;
  attempts: number;
  jokerUsed: boolean;
  points: number;
}

/** `handoff` : écran de passage au joueur suivant. `summary` : classement de fin de manche. */
export type FamilyPhase = "handoff" | "playing" | "summary" | "finished";

export interface FamilyPlayerState extends FamilyPlayer {
  jokersLeft: number;
}

export interface FamilyGame {
  id: string;
  scope: FamilyScope;
  duration: FamilyDuration;
  players: FamilyPlayerState[];
  /** Questions de chaque manche, rangées comme `players`. */
  plan: string[][];
  round: number;
  /** Position dans l'ordre de passage de la manche. */
  turn: number;
  phase: FamilyPhase;
  /** Tour en cours, `null` hors de la phase `playing`. */
  run: LevelRun | null;
  turns: FamilyTurn[];
  startedAt: string;
  finishedAt: string | null;
}

export interface NewFamilyGame {
  id: string;
  scope: FamilyScope;
  duration: FamilyDuration;
  players: FamilyPlayer[];
  plan: string[][];
  startedAt: string;
}

export function createFamilyGame({ id, scope, duration, players, plan, startedAt }: NewFamilyGame): FamilyGame {
  if (players.length < FAMILY_RULES.minPlayers || players.length > FAMILY_RULES.maxPlayers) throw new Error("Nombre de joueurs invalide");
  if (plan.length !== FAMILY_RULES.rounds[duration] || plan.some((round) => round.length !== players.length)) throw new Error("Tirage invalide");
  return {
    id,
    scope,
    duration,
    players: players.map((player) => ({ ...player, jokersLeft: FAMILY_RULES.jokers[duration] })),
    plan,
    round: 0,
    turn: 0,
    phase: "handoff",
    run: null,
    turns: [],
    startedAt,
    finishedAt: null,
  };
}

/** Le premier joueur change à chaque manche : personne ne commence toujours. */
export const playerIndexAt = (game: Pick<FamilyGame, "players" | "round" | "turn">): number =>
  (game.round + game.turn) % game.players.length;

export const currentPlayer = (game: FamilyGame): FamilyPlayerState => game.players[playerIndexAt(game)] as FamilyPlayerState;

export const totalRounds = (game: Pick<FamilyGame, "plan">): number => game.plan.length;

export function beginTurn(game: FamilyGame, bank: RunBank, random: RandomSource): FamilyGame {
  if (game.phase !== "handoff") return game;
  const index = playerIndexAt(game);
  const challengeId = game.plan[game.round]?.[index];
  if (!challengeId) throw new Error("Tour introuvable");
  const player = game.players[index] as FamilyPlayerState;
  const run = startRun(bank, [challengeId], random, { maxAttempts: FAMILY_RULES.maxAttempts, jokers: player.jokersLeft });
  return { ...game, phase: "playing", run };
}

/** Les points du tour suivent le barème Famille, pas celui des niveaux. */
function withFamilyPoints(run: LevelRun): LevelRun {
  const last = run.results.at(-1);
  if (run.state === "playing" || !last) return run;
  return { ...run, results: [...run.results.slice(0, -1), { ...last, points: familyPointsFor(last) }] };
}

export function answerTurn(game: FamilyGame, bank: RunBank, answerId: string): FamilyGame {
  if (game.phase !== "playing" || !game.run) return game;
  return { ...game, run: withFamilyPoints(submitAnswer(game.run, bank, answerId)) };
}

export function jokerTurn(game: FamilyGame, bank: RunBank, random: RandomSource): FamilyGame {
  if (game.phase !== "playing" || !game.run) return game;
  return { ...game, run: applyJoker(game.run, bank, random) };
}

/** Enregistre le tour terminé, puis passe au joueur suivant, au classement de la manche ou à la fin. */
export function endTurn(game: FamilyGame, now: string): FamilyGame {
  const result = game.run?.results.at(-1);
  if (game.phase !== "playing" || !game.run || game.run.state === "playing" || !result) return game;
  const index = playerIndexAt(game);
  const player = game.players[index] as FamilyPlayerState;
  const turn: FamilyTurn = {
    round: game.round,
    playerId: player.id,
    challengeId: result.challengeId,
    correct: result.correct,
    attempts: result.attempts,
    jokerUsed: result.jokerUsed,
    points: familyPointsFor(result),
  };
  const players = game.players.map((candidate, i) => (i === index ? { ...candidate, jokersLeft: game.run?.jokersLeft ?? 0 } : candidate));
  const base = { ...game, players, run: null, turns: [...game.turns, turn] };
  if (game.turn < game.players.length - 1) return { ...base, turn: game.turn + 1, phase: "handoff" };
  if (game.round < totalRounds(game) - 1) return { ...base, phase: "summary" };
  return { ...base, phase: "finished", finishedAt: now };
}

export function nextRound(game: FamilyGame): FamilyGame {
  if (game.phase !== "summary") return game;
  return { ...game, round: game.round + 1, turn: 0, phase: "handoff" };
}

export interface FamilyStanding {
  player: FamilyPlayer;
  points: number;
  correct: number;
  /** Bonnes réponses trouvées au deuxième essai, après l'indice. */
  hints: number;
  jokers: number;
  /** 1 pour le premier. Les ex æquo partagent le même rang. */
  rank: number;
}

/** Classement, du premier au dernier. À points égaux, les joueurs sont ex æquo. */
export function familyStandings(game: Pick<FamilyGame, "players" | "turns">): FamilyStanding[] {
  const rows = game.players.map((player, order) => {
    const turns = game.turns.filter((turn) => turn.playerId === player.id);
    return {
      order,
      player: { id: player.id, name: player.name, color: player.color },
      points: turns.reduce((total, turn) => total + turn.points, 0),
      correct: turns.filter((turn) => turn.correct).length,
      hints: turns.filter((turn) => turn.correct && turn.attempts > 1).length,
      jokers: turns.filter((turn) => turn.jokerUsed).length,
    };
  });
  rows.sort((a, b) => b.points - a.points || a.order - b.order);
  return rows.map((row) => ({
    player: row.player,
    points: row.points,
    correct: row.correct,
    hints: row.hints,
    jokers: row.jokers,
    rank: 1 + rows.filter((other) => other.points > row.points).length,
  }));
}

export const familyWinners = (standings: readonly FamilyStanding[]): FamilyStanding[] => standings.filter((row) => row.rank === 1);

/** Questions d'une partie, pour éviter de les reprendre trop vite. */
export const gameQuestions = (game: Pick<FamilyGame, "plan">): string[] => game.plan.flat();

/** Vrai si toutes les questions du tirage existent encore dans la réserve : sinon, la partie ne peut pas reprendre. */
export const isGameResumable = (game: Pick<FamilyGame, "plan" | "finishedAt">, bank: RunBank): boolean =>
  game.finishedAt === null && game.plan.flat().every((id) => bank.questions.some((question) => question.id === id));
