/** Règles d'une partie de niveau, sans interface : toute action rend un nouvel état. */
import { questionsPerRunOf } from "./question-selection.ts";
import { type RandomSource, shuffled } from "./random.ts";
import type { Level, LevelChallenge, StarThresholds } from "./types.ts";

export const LEVEL_RULES = {
  maxAttempts: 2,
  jokersPerLevel: 2,
  points: { first: 100, firstWithJoker: 75, second: 50, secondWithJoker: 25 },
} as const;

/** Ce qui peut changer d'un mode de jeu à l'autre. Sans précision, une partie suit les règles des niveaux. */
export interface RunRules {
  maxAttempts: number;
  jokers: number;
}

const LEVEL_RUN_RULES: RunRules = { maxAttempts: LEVEL_RULES.maxAttempts, jokers: LEVEL_RULES.jokersPerLevel };

/** Le minimum qu'une partie doit connaître de sa banque : un niveau ou le tirage d'un défi spécial. */
export type RunBank = Pick<Level, "id" | "questions">;

export type StarCount = 0 | 1 | 2 | 3;

export type ChallengeState = "playing" | "correct" | "failed";

export interface ChallengeResult {
  challengeId: string;
  correct: boolean;
  /** Nombre d'essais utilisés. */
  attempts: number;
  jokerUsed: boolean;
  points: number;
}

export interface LevelRun {
  levelId: string;
  /** Essais permis sur chaque défi de cette partie. */
  maxAttempts: number;
  /** Défis de cette partie, fixés au départ. */
  challengeIds: string[];
  /** Position du défi en cours. */
  index: number;
  jokersLeft: number;
  /** Ordre d'affichage des réponses du défi en cours. */
  answerOrder: string[];
  /** Réponses déjà proposées par le joueur sur ce défi. */
  tried: string[];
  /** Réponses retirées par le joker sur ce défi. */
  removed: string[];
  jokerUsed: boolean;
  state: ChallengeState;
  /** Résultats des défis terminés, dans l'ordre. */
  results: ChallengeResult[];
}

function challengeAt(level: RunBank, challengeIds: readonly string[], index: number): LevelChallenge {
  const challenge = level.questions.find((question) => question.id === challengeIds[index]);
  if (!challenge) throw new Error(`Défi introuvable : ${level.id} n° ${index}`);
  return challenge;
}

const freshChallenge = (level: RunBank, challengeIds: readonly string[], index: number, random: RandomSource) => ({
  index,
  answerOrder: shuffled(challengeAt(level, challengeIds, index).answers.map((answer) => answer.id), random),
  tried: [],
  removed: [],
  jokerUsed: false,
  state: "playing" as const,
});

export function startRun(level: RunBank, challengeIds: string[], random: RandomSource, rules: RunRules = LEVEL_RUN_RULES): LevelRun {
  return { levelId: level.id, maxAttempts: rules.maxAttempts, challengeIds, jokersLeft: rules.jokers, results: [], ...freshChallenge(level, challengeIds, 0, random) };
}

export const currentChallenge = (run: LevelRun, level: RunBank): LevelChallenge => challengeAt(level, run.challengeIds, run.index);

export function pointsFor(attempt: number, jokerUsed: boolean): number {
  const { first, firstWithJoker, second, secondWithJoker } = LEVEL_RULES.points;
  if (attempt === 1) return jokerUsed ? firstWithJoker : first;
  if (attempt === 2) return jokerUsed ? secondWithJoker : second;
  return 0;
}

export function starsFor(score: number, { one, two, three }: StarThresholds): StarCount {
  if (score >= three) return 3;
  if (score >= two) return 2;
  if (score >= one) return 1;
  return 0;
}

export const scoreOf = (run: LevelRun): number => run.results.reduce((total, result) => total + result.points, 0);

export const maxScoreOf = (level: Level): number => questionsPerRunOf(level) * LEVEL_RULES.points.first;

/** Une réponse reste proposable si elle n'a été ni essayée ni retirée par le joker. */
export const isAnswerAvailable = (run: LevelRun, answerId: string): boolean =>
  run.state === "playing" && !run.tried.includes(answerId) && !run.removed.includes(answerId);

/** État d'affichage d'une réponse : « revealed » montre la bonne réponse après un échec. */
export type AnswerState = "idle" | "removed" | "wrong" | "correct" | "revealed";

export function answerStateOf(run: LevelRun, challenge: LevelChallenge, answerId: string): AnswerState {
  if (run.state !== "playing" && answerId === challenge.answerId) return run.state === "correct" ? "correct" : "revealed";
  if (run.tried.includes(answerId)) return "wrong";
  if (run.removed.includes(answerId)) return "removed";
  return "idle";
}

/** L'indice apparaît après une première erreur, tant que le défi est en cours. */
export const isHintVisible = (run: LevelRun): boolean => run.state === "playing" && run.tried.length > 0;

const remainingWrong = (run: LevelRun, challenge: LevelChallenge): string[] =>
  run.answerOrder.filter((id) => id !== challenge.answerId && isAnswerAvailable(run, id));

export const canUseJoker = (run: LevelRun, level: RunBank): boolean =>
  run.state === "playing" && run.jokersLeft > 0 && !run.jokerUsed && remainingWrong(run, currentChallenge(run, level)).length > 0;

/** Retire environ la moitié des mauvaises réponses encore proposées, au moins une. */
export function applyJoker(run: LevelRun, level: RunBank, random: RandomSource): LevelRun {
  if (!canUseJoker(run, level)) return run;
  const wrong = remainingWrong(run, currentChallenge(run, level));
  const removed = shuffled(wrong, random).slice(0, Math.ceil(wrong.length / 2));
  return { ...run, jokersLeft: run.jokersLeft - 1, jokerUsed: true, removed: [...run.removed, ...removed] };
}

export function submitAnswer(run: LevelRun, level: RunBank, answerId: string): LevelRun {
  if (!isAnswerAvailable(run, answerId)) return run;
  const challenge = currentChallenge(run, level);
  const tried = [...run.tried, answerId];
  const correct = answerId === challenge.answerId;
  if (!correct && tried.length < run.maxAttempts) return { ...run, tried };

  const result: ChallengeResult = {
    challengeId: challenge.id,
    correct,
    attempts: tried.length,
    jokerUsed: run.jokerUsed,
    points: correct ? pointsFor(tried.length, run.jokerUsed) : 0,
  };
  return { ...run, tried, state: correct ? "correct" : "failed", results: [...run.results, result] };
}

/** Vrai quand le dernier défi est terminé. */
export const isRunOver = (run: LevelRun): boolean =>
  run.state !== "playing" && run.index === run.challengeIds.length - 1;

export function nextChallenge(run: LevelRun, level: RunBank, random: RandomSource): LevelRun {
  if (run.state === "playing" || isRunOver(run)) return run;
  return { ...run, ...freshChallenge(level, run.challengeIds, run.index + 1, random) };
}

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isCount = (value: unknown, min = 0): value is number => typeof value === "number" && Number.isInteger(value) && value >= min;

function isResult(value: unknown, challengeId: string | undefined): value is ChallengeResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<ChallengeResult>;
  return (
    result.challengeId === challengeId &&
    typeof result.correct === "boolean" &&
    isCount(result.attempts) &&
    typeof result.jokerUsed === "boolean" &&
    isCount(result.points)
  );
}

/**
 * Vrai si une partie gardée sur l'appareil se rejoue telle quelle avec la banque actuelle :
 * mêmes défis, un résultat par défi déjà joué, réponses du défi en cours connues. Sinon elle n'est pas proposée.
 */
export function isRunResumable(value: unknown, level: RunBank): value is LevelRun {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Partial<LevelRun>;
  if (run.levelId !== level.id || !isStrings(run.challengeIds) || run.challengeIds.length === 0) return false;
  const challengeIds = run.challengeIds;
  if (!challengeIds.every((id) => level.questions.some((question) => question.id === id))) return false;
  if (!isCount(run.index) || run.index >= challengeIds.length || !isCount(run.maxAttempts, 1) || !isCount(run.jokersLeft)) return false;
  if (run.state !== "playing" && run.state !== "correct" && run.state !== "failed") return false;
  if (typeof run.jokerUsed !== "boolean" || !isStrings(run.answerOrder) || !isStrings(run.tried) || !isStrings(run.removed)) return false;
  const played = run.index + (run.state === "playing" ? 0 : 1);
  if (!Array.isArray(run.results) || run.results.length !== played) return false;
  if (!run.results.every((result, index) => isResult(result, challengeIds[index]))) return false;
  const answers = challengeAt(level, challengeIds, run.index).answers.map((answer) => answer.id);
  const known = (ids: readonly string[]) => ids.every((id) => answers.includes(id));
  return run.answerOrder.length === answers.length && known(run.answerOrder) && known(run.tried) && known(run.removed);
}
