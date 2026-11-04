/** Composition d'une partie à partir de la banque d'un niveau, commune à tous les pays. */
import { type RandomSource, shuffled } from "./random.ts";
import type { Level, LevelChallenge } from "./types.ts";

export const SELECTION_RULES = {
  questionsPerRun: 8,
  maxPerCategory: 2,
  /** Une question vue lors des N dernières parties n'est reprise que si la réserve manque. */
  recentPlays: 2,
  /** Une question ratée revient au plus tôt après N autres parties. */
  reviewDelayPlays: 2,
  maxReviewsPerRun: 2,
} as const;

export interface QuestionMemory {
  /** Numéro de la dernière partie où la question est apparue. */
  lastPlay: number;
  /** Vrai si elle a été ratée cette fois-là. */
  missed: boolean;
}

/** Historique minimal d'un niveau : seules les parties terminées y entrent. */
export interface QuestionHistory {
  plays: number;
  questions: Record<string, QuestionMemory>;
}

export const EMPTY_HISTORY: QuestionHistory = { plays: 0, questions: {} };

/** Ce que le tirage lit : la banque d'un niveau ou celle d'un défi spécial. */
export type QuestionBank = Pick<Level, "questions" | "minDifficulty" | "maxDifficulty">;

const eligibleQuestions = (level: QuestionBank): LevelChallenge[] =>
  level.questions.filter((question) => question.difficulty >= level.minDifficulty && question.difficulty <= level.maxDifficulty);

/** Une question sans groupe forme à elle seule son propre groupe. */
const groupOf = (question: LevelChallenge): string => question.group ?? `id:${question.id}`;

/** Nombre de questions d'une partie : il ne dépend pas de l'historique du joueur. */
export function questionsPerRunOf(level: QuestionBank, target: number = SELECTION_RULES.questionsPerRun): number {
  const groups = new Set(eligibleQuestions(level).map(groupOf));
  return Math.min(groups.size, target);
}

const Rank = { Review: 0, Unseen: 1, Older: 2, Recent: 3, Avoided: 4 } as const;

/** Réglages facultatifs d'un tirage. Sans eux, le tirage d'un niveau reste inchangé. */
export interface SelectionOptions {
  /** Questions reprises seulement si la banque ne permet pas de faire autrement. */
  avoid?: ReadonlySet<string>;
  /** Une question de chaque thème de la banque d'abord, tant que la partie a la place. */
  coverCategories?: boolean;
}

/** Les questions de la dernière partie terminée d'un historique. */
export const lastRunQuestions = (history: QuestionHistory): Set<string> =>
  new Set(Object.entries(history.questions).filter(([, memory]) => memory.lastPlay === history.plays).map(([id]) => id));

/** Classe la banque, de la question à proposer en premier à celle à éviter. */
function rankedQuestions(questions: LevelChallenge[], history: QuestionHistory, random: RandomSource, avoid?: ReadonlySet<string>): LevelChallenge[] {
  const age = (question: LevelChallenge) => history.plays - (history.questions[question.id]?.lastPlay ?? 0);
  let reviews = 0;
  const ranked = shuffled(questions, random)
    // Les erreurs les plus anciennes reviennent d'abord ; à âge égal, l'ordre reste aléatoire.
    .sort((a, b) => age(b) - age(a))
    .map((question) => {
      if (avoid?.has(question.id)) return { question, rank: Rank.Avoided };
      const memory = history.questions[question.id];
      if (!memory) return { question, rank: Rank.Unseen };
      const questionAge = history.plays - memory.lastPlay;
      if (memory.missed && questionAge >= SELECTION_RULES.reviewDelayPlays && reviews < SELECTION_RULES.maxReviewsPerRun) {
        reviews += 1;
        return { question, rank: Rank.Review };
      }
      return { question, rank: questionAge < SELECTION_RULES.recentPlays ? Rank.Recent : Rank.Older };
    });
  return ranked.sort((a, b) => a.rank - b.rank).map(({ question }) => question);
}

/**
 * Choisit les questions d'une partie et rend leurs identifiants.
 * Le résultat est calculé une fois au départ : la partie ne change plus ensuite.
 * Les règles de diversité cèdent seulement si la banque ne permet pas de les tenir.
 */
export function selectQuestions(
  level: QuestionBank,
  history: QuestionHistory,
  random: RandomSource,
  target: number = SELECTION_RULES.questionsPerRun,
  options: SelectionOptions = {},
): string[] {
  const size = questionsPerRunOf(level, target);
  const ranked = rankedQuestions(eligibleQuestions(level), history, random, options.avoid);
  const picked: LevelChallenge[] = [];

  const canPick = (question: LevelChallenge, maxPerCategory: number) =>
    picked.length < size &&
    !picked.includes(question) &&
    !picked.some((other) => groupOf(other) === groupOf(question)) &&
    picked.filter((other) => other.category === question.category).length < maxPerCategory;

  // Un défi de chaque type présent dans la banque, puis le reste selon le classement.
  for (const kind of shuffled([...new Set(ranked.map((question) => question.kind))], random)) {
    const question = ranked.find((candidate) => candidate.kind === kind && canPick(candidate, SELECTION_RULES.maxPerCategory));
    if (question) picked.push(question);
  }
  if (options.coverCategories) {
    for (const category of shuffled([...new Set(ranked.map((question) => question.category))], random)) {
      if (picked.some((other) => other.category === category)) continue;
      const question = ranked.find((candidate) => candidate.category === category && canPick(candidate, SELECTION_RULES.maxPerCategory));
      if (question) picked.push(question);
    }
  }
  for (const maxPerCategory of [SELECTION_RULES.maxPerCategory, size]) {
    for (const question of ranked) {
      if (canPick(question, maxPerCategory)) picked.push(question);
    }
  }
  return shuffled(picked, random).map((question) => question.id);
}

/** Ajoute une partie terminée à l'historique. Réussir une question ratée efface l'erreur. */
export function withRunResults(
  history: QuestionHistory,
  results: readonly { challengeId: string; correct: boolean }[],
): QuestionHistory {
  const plays = history.plays + 1;
  const questions = { ...history.questions };
  for (const { challengeId, correct } of results) {
    questions[challengeId] = { lastPlay: plays, missed: !correct };
  }
  return { plays, questions };
}
