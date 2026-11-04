/** Règles d'une partie de niveau, sans interface : toute action rend un nouvel état. */
import type { Level, LevelChallenge, StarThresholds } from "./types";

export const LEVEL_RULES = {
  challengesPerLevel: 8,
  maxAttempts: 2,
  jokersPerLevel: 2,
  points: { first: 100, firstWithJoker: 75, second: 50, secondWithJoker: 25 },
} as const;

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

export type RandomSource = () => number;

function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function challengeAt(level: Level, index: number): LevelChallenge {
  const challenge = level.challenges[index];
  if (!challenge) throw new Error(`Défi introuvable : ${level.id} n° ${index}`);
  return challenge;
}

const freshChallenge = (level: Level, index: number, random: RandomSource) => ({
  index,
  answerOrder: shuffled(challengeAt(level, index).answers.map((answer) => answer.id), random),
  tried: [],
  removed: [],
  jokerUsed: false,
  state: "playing" as const,
});

export function startRun(level: Level, random: RandomSource): LevelRun {
  return { levelId: level.id, jokersLeft: LEVEL_RULES.jokersPerLevel, results: [], ...freshChallenge(level, 0, random) };
}

export const currentChallenge = (run: LevelRun, level: Level): LevelChallenge => challengeAt(level, run.index);

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

export const maxScoreOf = (level: Level): number => level.challenges.length * LEVEL_RULES.points.first;

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

export const canUseJoker = (run: LevelRun, level: Level): boolean =>
  run.state === "playing" && run.jokersLeft > 0 && !run.jokerUsed && remainingWrong(run, currentChallenge(run, level)).length > 0;

/** Retire environ la moitié des mauvaises réponses encore proposées, au moins une. */
export function applyJoker(run: LevelRun, level: Level, random: RandomSource): LevelRun {
  if (!canUseJoker(run, level)) return run;
  const wrong = remainingWrong(run, currentChallenge(run, level));
  const removed = shuffled(wrong, random).slice(0, Math.ceil(wrong.length / 2));
  return { ...run, jokersLeft: run.jokersLeft - 1, jokerUsed: true, removed: [...run.removed, ...removed] };
}

export function submitAnswer(run: LevelRun, level: Level, answerId: string): LevelRun {
  if (!isAnswerAvailable(run, answerId)) return run;
  const challenge = currentChallenge(run, level);
  const tried = [...run.tried, answerId];
  const correct = answerId === challenge.answerId;
  if (!correct && tried.length < LEVEL_RULES.maxAttempts) return { ...run, tried };

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
export const isRunOver = (run: LevelRun, level: Level): boolean =>
  run.state !== "playing" && run.index === level.challenges.length - 1;

export function nextChallenge(run: LevelRun, level: Level, random: RandomSource): LevelRun {
  if (run.state === "playing" || isRunOver(run, level)) return run;
  return { ...run, ...freshChallenge(level, run.index + 1, random) };
}
