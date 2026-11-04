// Vérifie les règles d'une partie sur un niveau de 8 défis. Usage : node scripts/check-engine.mjs
import assert from "node:assert/strict";
import {
  applyJoker,
  answerStateOf,
  canUseJoker,
  currentChallenge,
  isAnswerAvailable,
  isHintVisible,
  isRunOver,
  maxScoreOf,
  nextChallenge,
  pointsFor,
  scoreOf,
  starsFor,
  startRun,
  submitAnswer,
} from "../src/engine/level-run.ts";

const answers = (count) => Array.from({ length: count }, (_, i) => ({ id: `a${i}`, labelKey: `k${i}` }));
const level = {
  id: "niveau",
  slug: "niveau",
  nameKey: "n",
  descriptionKey: "d",
  stars: { one: 0, two: 400, three: 640 },
  rewardCardIds: [],
  challenges: Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    kind: "choice",
    promptKey: "p",
    hintKey: "h",
    anecdoteKey: "x",
    answerId: "a0",
    answers: answers(i === 0 ? 10 : 4),
  })),
};
const random = () => 0.5;

// Barème et étoiles.
assert.deepEqual([pointsFor(1, false), pointsFor(1, true), pointsFor(2, false), pointsFor(2, true), pointsFor(3, false)], [100, 75, 50, 25, 0]);
assert.equal(maxScoreOf(level), 800);
assert.deepEqual([0, 399, 400, 639, 640, 800].map((score) => starsFor(score, level.stars)), [1, 1, 2, 2, 3, 3]);

// Premier essai : 100 points, pas d'indice.
let run = startRun(level, random);
assert.equal(run.answerOrder.length, 10);
assert.equal(isHintVisible(run), false);
run = submitAnswer(run, level, "a0");
assert.equal(run.state, "correct");
assert.equal(scoreOf(run), 100);
assert.equal(submitAnswer(run, level, "a1"), run, "un défi terminé n'accepte plus de réponse");

// Joker sur 3 mauvaises réponses : 2 retirées, jamais la bonne, 75 points.
run = nextChallenge(run, level, random);
run = applyJoker(run, level, random);
assert.equal(run.jokersLeft, 1);
assert.equal(run.removed.length, 2);
assert.equal(run.removed.includes("a0"), false);
assert.equal(canUseJoker(run, level), false, "un seul joker par défi");
assert.equal(applyJoker(run, level, random), run);
assert.equal(isAnswerAvailable(run, run.removed[0]), false);
assert.equal(answerStateOf(run, currentChallenge(run, level), run.removed[0]), "removed");
run = submitAnswer(run, level, "a0");
assert.equal(run.results.at(-1).points, 75);

// Deuxième essai : indice après l'erreur, 50 points.
run = nextChallenge(run, level, random);
run = submitAnswer(run, level, "a1");
assert.equal(run.state, "playing");
assert.equal(isHintVisible(run), true);
assert.equal(submitAnswer(run, level, "a1"), run, "une réponse déjà essayée ne compte pas");
run = submitAnswer(run, level, "a0");
assert.equal(run.results.at(-1).points, 50);
assert.equal(run.results.at(-1).attempts, 2);

// Deuxième essai avec joker : 25 points.
run = nextChallenge(run, level, random);
run = submitAnswer(run, level, "a1");
run = applyJoker(run, level, random);
assert.equal(run.jokersLeft, 0);
run = submitAnswer(run, level, "a0");
assert.equal(run.results.at(-1).points, 25);

// Plus de joker disponible.
run = nextChallenge(run, level, random);
assert.equal(canUseJoker(run, level), false);

// Deux erreurs : échec, 0 point, la bonne réponse est montrée.
run = submitAnswer(submitAnswer(run, level, "a1"), level, "a2");
assert.equal(run.state, "failed");
assert.equal(run.results.at(-1).points, 0);
assert.equal(answerStateOf(run, currentChallenge(run, level), "a0"), "revealed");

// Fin de partie.
while (!isRunOver(run, level)) {
  run = submitAnswer(nextChallenge(run, level, random), level, "a0");
}
assert.equal(run.results.length, 8);
assert.equal(scoreOf(run), 100 + 75 + 50 + 25 + 0 + 300);
assert.equal(nextChallenge(run, level, random), run);

console.log("Moteur de jeu valide.");
