// Vérifie les règles d'une partie et le tirage dans une banque. Usage : node scripts/check-engine.mjs
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
import { isLevelUnlocked, UNLOCK_RULES } from "../src/engine/level-unlock.ts";
import { earnedXp, summarizeCountry, summarizeProgress, xpAfterRun, xpForScore } from "../src/engine/progress-summary.ts";
import { EMPTY_HISTORY, questionsPerRunOf, SELECTION_RULES, selectQuestions, withRunResults } from "../src/engine/question-selection.ts";

const answers = (count) => Array.from({ length: count }, (_, i) => ({ id: `a${i}`, labelKey: `k${i}` }));
const question = (id, overrides = {}) => ({
  id,
  kind: "choice",
  category: id,
  difficulty: 1,
  promptKey: "p",
  hintKey: "h",
  anecdoteKey: "x",
  answerId: "a0",
  answers: answers(4),
  ...overrides,
});
const levelWith = (questions, maxDifficulty = 2, minDifficulty = 1) => ({
  id: "niveau",
  slug: "niveau",
  nameKey: "n",
  descriptionKey: "d",
  stars: { one: 0, two: 400, three: 640 },
  minDifficulty,
  maxDifficulty,
  rewardCardIds: [],
  questions,
});
const level = levelWith(Array.from({ length: 8 }, (_, i) => question(`c${i}`, { answers: answers(i === 0 ? 10 : 4) })));
const challengeIds = level.questions.map((candidate) => candidate.id);
const random = () => 0.5;

// Aléa reproductible : mulberry32.
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Barème et étoiles.
assert.deepEqual([pointsFor(1, false), pointsFor(1, true), pointsFor(2, false), pointsFor(2, true), pointsFor(3, false)], [100, 75, 50, 25, 0]);
assert.equal(maxScoreOf(level), 800);
assert.deepEqual([0, 399, 400, 639, 640, 800].map((score) => starsFor(score, level.stars)), [1, 1, 2, 2, 3, 3]);

// Premier essai : 100 points, pas d'indice.
let run = startRun(level, challengeIds, random);
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
while (!isRunOver(run)) {
  run = submitAnswer(nextChallenge(run, level, random), level, "a0");
}
assert.equal(run.results.length, 8);
assert.equal(scoreOf(run), 100 + 75 + 50 + 25 + 0 + 300);
assert.equal(nextChallenge(run, level, random), run);

// --- Tirage dans la banque ---

const CATEGORIES = ["departements", "villes", "geographie", "gastronomie", "patrimoine", "savoir-faire", "traditions", "personnalites"];
const bank = levelWith(
  Array.from({ length: 40 }, (_, i) =>
    question(`q${i}`, {
      category: CATEGORIES[i % CATEGORIES.length],
      ...(i % 10 === 0 ? { kind: "map", mapId: "m" } : i % 5 === 0 ? { kind: "visual", mediaId: `m${i}` } : {}),
    }),
  ),
);
const byId = (id, from = bank) => from.questions.find((candidate) => candidate.id === id);
const play = (history, ids, missed = []) =>
  withRunResults(history, ids.map((challengeId) => ({ challengeId, correct: !missed.includes(challengeId) })));

// Même aléa, même historique : même partie.
assert.deepEqual(selectQuestions(bank, EMPTY_HISTORY, seeded(1)), selectQuestions(bank, EMPTY_HISTORY, seeded(1)));

// Huit questions sans doublon, diversité de catégories et de types, sur de nombreux tirages.
for (let seed = 0; seed < 200; seed++) {
  const ids = selectQuestions(bank, EMPTY_HISTORY, seeded(seed));
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8, "aucun doublon dans une partie");
  const picked = ids.map((id) => byId(id));
  assert.equal(new Set(picked.map((candidate) => candidate.kind)).size, 3, "tous les types sont présents");
  for (const category of CATEGORIES) {
    assert.ok(picked.filter((candidate) => candidate.category === category).length <= SELECTION_RULES.maxPerCategory);
  }
}

// Parties successives : toutes différentes, sans reprise tant qu'il reste du neuf, jusqu'à voir toute la banque.
// Seule exception : la présence garantie d'un type peut reprendre une carte ou une photo déjà vue.
{
  const random = seeded(7);
  let history = EMPTY_HISTORY;
  let previous = [];
  const seen = new Set();
  for (let play_ = 0; play_ < 6; play_++) {
    const ids = selectQuestions(bank, history, random);
    const repeats = ids.filter((id) => seen.has(id));
    if (play_ < 4) assert.equal(repeats.length, 0, `partie ${play_ + 1} : une question déjà vue passe avant du neuf`);
    assert.notDeepEqual([...ids].sort(), [...previous].sort());
    ids.forEach((id) => seen.add(id));
    previous = ids;
    history = play(history, ids);
  }
  assert.equal(seen.size, 40, "la banque entière est vue en six parties");
  // Banque épuisée : les questions des deux dernières parties restent évitées.
  const next = selectQuestions(bank, history, random);
  const recent = Object.entries(history.questions).filter(([, memory]) => history.plays - memory.lastPlay < SELECTION_RULES.recentPlays).map(([id]) => id);
  assert.equal(next.filter((id) => recent.includes(id)).length, 0, "pas de reprise récente quand la réserve suffit");
}

// Une erreur attend son délai, puis revient ; une réussite efface l'erreur.
{
  const random = seeded(11);
  const firstRun = selectQuestions(bank, EMPTY_HISTORY, random);
  const missedId = firstRun[0];
  let history = play(EMPTY_HISTORY, firstRun, [missedId]);
  assert.equal(history.questions[missedId].missed, true);
  const secondRun = selectQuestions(bank, history, random);
  assert.equal(secondRun.includes(missedId), false, "pas de retour à la partie suivante");
  history = play(history, secondRun);
  const thirdRun = selectQuestions(bank, history, random);
  assert.equal(thirdRun.includes(missedId), false, "pas de retour avant deux autres parties");
  history = play(history, thirdRun);
  const fourthRun = selectQuestions(bank, history, random);
  assert.equal(fourthRun.includes(missedId), true, "retour après le délai");
  history = play(history, fourthRun);
  assert.equal(history.questions[missedId].missed, false);
}

// Les erreurs reviennent progressivement : deux au plus par partie, sans bloquer le neuf.
{
  // Un seul type de défi ici : sa présence garantie ne peut pas ramener une question de plus.
  const choices = levelWith(Array.from({ length: 40 }, (_, i) => question(`q${i}`, { category: CATEGORIES[i % CATEGORIES.length] })));
  const random = seeded(13);
  const firstRun = selectQuestions(choices, EMPTY_HISTORY, random);
  let history = play(EMPTY_HISTORY, firstRun, firstRun);
  history = play(history, selectQuestions(choices, history, random));
  history = play(history, selectQuestions(choices, history, random));
  const fourthRun = selectQuestions(choices, history, random);
  assert.equal(fourthRun.filter((id) => firstRun.includes(id)).length, SELECTION_RULES.maxReviewsPerRun);
}

// Un même groupe ne sort qu'une fois, et ne compte que pour une place.
{
  const grouped = levelWith([
    ...Array.from({ length: 8 }, (_, i) => question(`g${i}`, { group: "meme-fait" })),
    ...Array.from({ length: 7 }, (_, i) => question(`h${i}`)),
  ]);
  assert.equal(questionsPerRunOf(grouped), 8);
  for (let seed = 0; seed < 50; seed++) {
    const ids = selectQuestions(grouped, EMPTY_HISTORY, seeded(seed));
    assert.equal(ids.length, 8);
    assert.equal(ids.filter((id) => id.startsWith("g")).length, 1);
  }
}

// La difficulté du niveau écarte les questions trop dures.
{
  const mixed = levelWith([...Array.from({ length: 8 }, (_, i) => question(`f${i}`)), question("dure", { difficulty: 3 })], 1);
  for (let seed = 0; seed < 50; seed++) assert.equal(selectQuestions(mixed, EMPTY_HISTORY, seeded(seed)).includes("dure"), false);
  const hard = levelWith([...Array.from({ length: 8 }, (_, i) => question(`d${i}`, { difficulty: 3 })), question("facile")], 3, 2);
  for (let seed = 0; seed < 50; seed++) assert.equal(selectQuestions(hard, EMPTY_HISTORY, seeded(seed)).includes("facile"), false);
  assert.equal(questionsPerRunOf(hard), 8);
}

// Déblocage : le premier niveau est ouvert, les suivants demandent deux étoiles au précédent.
{
  const previous = levelWith([]);
  assert.equal(UNLOCK_RULES.stars, 2);
  assert.equal(isLevelUnlocked(null, {}), true);
  assert.equal(isLevelUnlocked(previous, {}), false);
  assert.equal(isLevelUnlocked(previous, { niveau: { bestScore: 399 } }), false);
  assert.equal(isLevelUnlocked(previous, { niveau: { bestScore: 400 } }), true);
  assert.equal(isLevelUnlocked(previous, { autre: { bestScore: 800 } }), false);
}

// Progression cumulée : recalculée depuis les résultats, chaque niveau compté une fois pour son meilleur score.
{
  const stars = { one: 0, two: 400, three: 640 };
  const levels = ["n1", "n2", "n3", "n4", "n5"].map((id) => ({ id, stars, maxScore: 800 }));

  assert.deepEqual(summarizeProgress(levels, {}), { levelsFinished: 0, levelsTotal: 5, bestScoreTotal: 0, bestScoreMax: 4000, stars: 0, starsMax: 15, xp: 0 });

  // XP : 10 points pour 1 XP, à l'unité inférieure.
  assert.deepEqual([0, 9, 10, 725, 800].map(xpForScore), [0, 0, 1, 72, 80]);

  // Un niveau terminé fait monter les compteurs, même à 0 point : une partie terminée vaut une étoile.
  const zero = summarizeProgress(levels, { n1: { bestScore: 0, xp: 0 } });
  assert.deepEqual([zero.levelsFinished, zero.bestScoreTotal, zero.stars, zero.xp], [1, 0, 1, 0]);

  // Les cinq niveaux se cumulent.
  const all = summarizeProgress(levels, {
    n1: { bestScore: 725, xp: 72 },
    n2: { bestScore: 800, xp: 80 },
    n3: { bestScore: 400, xp: 40 },
    n4: { bestScore: 399, xp: 39 },
    n5: { bestScore: 640, xp: 64 },
  });
  assert.deepEqual(all, { levelsFinished: 5, levelsTotal: 5, bestScoreTotal: 2964, bestScoreMax: 4000, stars: 3 + 3 + 2 + 1 + 3, starsMax: 15, xp: 295 });

  // Rejouer sans record : le total des points et les étoiles ne bougent pas, l'XP augmente.
  const before = { bestScore: 725, xp: 72 };
  const replayed = { bestScore: Math.max(725, 300), xp: xpAfterRun(before, 300) };
  const [a, b] = [summarizeProgress(levels, { n1: before }), summarizeProgress(levels, { n1: replayed })];
  assert.deepEqual([b.levelsFinished, b.bestScoreTotal, b.stars], [a.levelsFinished, a.bestScoreTotal, a.stars]);
  assert.equal(b.xp, 72 + 30);

  // Un record actualise le cumul.
  const improved = summarizeProgress(levels, { n1: { bestScore: 800, xp: xpAfterRun(before, 800) } });
  assert.deepEqual([improved.bestScoreTotal, improved.stars, improved.xp], [800, 3, 152]);

  // Résultat enregistré avant l'XP : compté pour son meilleur score, puis complété à la partie suivante.
  assert.equal(earnedXp({ bestScore: 725 }), 72);
  assert.equal(xpAfterRun({ bestScore: 725 }, 100), 72 + 10);
  assert.equal(xpAfterRun(undefined, 100), 10);

  // Un résultat sans niveau correspondant ne compte pas.
  assert.equal(summarizeProgress(levels, { ancien: { bestScore: 800, xp: 80 } }).levelsFinished, 0);

  // Le pays applique les mêmes règles, un territoire sans niveau ne compte jamais comme exploré.
  const territories = [
    { id: "t1", levels },
    { id: "t2", levels: [{ id: "autre", stars, maxScore: 800 }] },
    { id: "vide", levels: [] },
  ];
  const records = { n1: { bestScore: 725, xp: 102 }, autre: { bestScore: 400, xp: 40 } };
  const country = summarizeCountry(territories, records);
  assert.deepEqual(country, { levelsFinished: 2, levelsTotal: 6, bestScoreTotal: 1125, bestScoreMax: 4800, stars: 5, starsMax: 18, xp: 142, territoriesExplored: 2 });
  assert.equal(summarizeCountry(territories, {}).territoriesExplored, 0);
  assert.equal(country.bestScoreTotal, summarizeProgress(levels, records).bestScoreTotal + summarizeProgress(territories[1].levels, records).bestScoreTotal);
}

// Banque insuffisante : la partie joue ce qui existe, sans rien inventer, même si les règles de diversité cèdent.
{
  const small = levelWith(Array.from({ length: 5 }, (_, i) => question(`s${i}`, { category: "seule" })));
  const ids = selectQuestions(small, EMPTY_HISTORY, seeded(3));
  assert.equal(ids.length, 5);
  assert.equal(new Set(ids).size, 5);
  assert.equal(maxScoreOf(small), 500);
  const again = selectQuestions(small, play(EMPTY_HISTORY, ids), seeded(4));
  assert.equal(again.length, 5, "des questions récentes plutôt qu'une partie vide");
}

// Une partie tirée reste figée, et la bonne réponse reste juste après mélange.
for (let seed = 0; seed < 50; seed++) {
  const random = seeded(seed);
  const ids = selectQuestions(bank, EMPTY_HISTORY, random);
  let current = startRun(bank, ids, random);
  let index = 0;
  while (true) {
    const challenge = currentChallenge(current, bank);
    assert.equal(challenge.id, ids[index], "les questions ne changent pas pendant la partie");
    assert.equal([...current.answerOrder].sort().join(), challenge.answers.map((answer) => answer.id).sort().join());
    if (index % 2 === 0) {
      current = applyJoker(current, bank, random);
      if (current.jokerUsed) {
        assert.equal(current.removed.length, 2, "le joker retire deux mauvaises réponses");
        assert.equal(current.removed.includes(challenge.answerId), false);
      }
    }
    current = submitAnswer(current, bank, challenge.answerId);
    assert.equal(current.state, "correct");
    if (isRunOver(current)) break;
    current = nextChallenge(current, bank, random);
    index += 1;
  }
  assert.deepEqual(current.results.map((result) => result.challengeId), ids);
  assert.equal(scoreOf(current), 6 * 100 + 2 * 75);
}

console.log("Moteur de jeu valide.");
