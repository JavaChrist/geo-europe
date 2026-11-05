// Vérifie les règles d'une partie et le tirage dans une banque. Usage : node scripts/check-engine.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { albumCollections, cardsByTheme, isBadgeEarned, isCardEarned, newRewards, summarizeCollections } from "../src/engine/album.ts";
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
import { applyReset, previewReset, resetTargets } from "../src/engine/progress-reset.ts";
import { earnedXp, summarizeCountry, summarizeProgress, xpAfterRun, xpForScore } from "../src/engine/progress-summary.ts";
import { EMPTY_HISTORY, lastRunQuestions, questionsPerRunOf, SELECTION_RULES, selectQuestions, withRunResults } from "../src/engine/question-selection.ts";
import {
  areSpecialChallengesUnlocked,
  availableSpecialChallenges,
  challengeKey,
  correctCount,
  elapsedMs,
  isBetterPerformance,
  isChallengePassed,
  isSpecialChallengeAvailable,
  remainingMs,
  SPECIAL_CHALLENGES,
  specialChallengeBank,
  drawSpecialChallenge,
  lastPlayedLevelId,
  rulesForTerritory,
  withChallengeResult,
} from "../src/engine/special-challenges.ts";

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

// Album : tout se déduit des résultats, quel que soit le score.
{
  const card = (id, themeId, levelId) => ({ id, territoryId: "t", themeId, nameKey: "n", descriptionKey: "d", anecdoteKey: "a", mediaId: "m", unlock: { kind: "level-finished", levelId } });
  const cards = [card("c1", "cities", "l1"), card("c2", "gastronomy", "l2"), card("c3", "cities", "l3")];
  const collector = { id: "b", kind: "collector", territoryId: "t", nameKey: "n", descriptionKey: "d", cardIds: ["c1", "c2", "c3"] };
  const master = { ...collector, id: "m", kind: "master", cardIds: [] };
  const territory = { id: "t", status: "published", souvenirCards: cards, badges: [collector, master] };
  const draft = { ...territory, id: "draft", status: "draft" };
  const empty = { ...territory, id: "empty", souvenirCards: [], badges: [] };
  const zero = { bestScore: 0 };

  assert.deepEqual(albumCollections([territory, draft, empty]), [territory], "ni brouillon ni territoire sans carte");
  assert.equal(isCardEarned(cards[0], {}), false);
  assert.equal(isCardEarned(cards[0], { l1: zero }), true, "aucun score minimal");

  // Une ancienne progression reconnue d'emblée, sans doublon.
  const old = { l1: { bestScore: 800 }, l2: zero };
  assert.deepEqual(summarizeCollections([territory], old), { cardsEarned: 2, cardsTotal: 3, badgesEarned: 0, badgesTotal: 2 });

  // Une seule carte dans chaque vue : les thèmes regroupent les mêmes objets.
  const groups = cardsByTheme([territory]);
  assert.deepEqual(groups.map((group) => group.themeId), ["cities", "gastronomy"]);
  assert.equal(groups.flatMap((group) => group.cards).length, cards.length);
  assert.equal(groups[0].cards[0], cards[0]);

  // Premier gain, puis rien au rejeu.
  const first = newRewards([territory], {}, { l1: zero });
  assert.deepEqual(first.cards.map((earned) => earned.id), ["c1"]);
  assert.deepEqual(first.badges, []);
  const replay = newRewards([territory], { l1: zero }, { l1: { bestScore: 800 } });
  assert.deepEqual(replay, { cards: [], badges: [] });
  assert.deepEqual(newRewards([draft], {}, { l1: zero }), { cards: [], badges: [] }, "un brouillon ne récompense pas");

  // Le badge arrive avec la dernière carte. Le badge de maîtrise reste distinct : les cartes ne le donnent pas.
  const all = { l1: zero, l2: zero, l3: zero };
  const last = newRewards([territory], { l1: zero, l2: zero }, all);
  assert.deepEqual(last.cards.map((earned) => earned.id), ["c3"]);
  assert.deepEqual(last.badges.map((badge) => badge.id), ["b"]);
  assert.equal(isBadgeEarned(master, cards, all), false);
  assert.equal(summarizeCollections([territory], all).badgesEarned, 1);

  // Une carte ajoutée plus tard à la collection ne retire pas le badge.
  assert.equal(isBadgeEarned(collector, [...cards, card("c4", "crafts", "l4")], all), true);

  // Le badge Maître vient de la réussite du défi : une seule fois, jamais perdu, sans doublon au rejeu.
  const passedRecord = { passed: true };
  const failedRecord = { passed: false };
  const key = challengeKey("t", "master");
  assert.equal(isBadgeEarned(master, cards, all, { [key]: failedRecord }), false);
  assert.equal(isBadgeEarned(master, cards, {}, { [key]: passedRecord }), true);
  assert.deepEqual(newRewards([territory], all, all, {}, { [key]: failedRecord }).badges, []);
  assert.deepEqual(newRewards([territory], all, all, {}, { [key]: passedRecord }).badges.map((badge) => badge.id), ["m"]);
  assert.deepEqual(newRewards([territory], all, all, { [key]: passedRecord }, { [key]: passedRecord }), { cards: [], badges: [] });
  assert.equal(summarizeCollections([territory], all, { [key]: passedRecord }).badgesEarned, 2);
}

// Défis spéciaux : une seule configuration pour tous les territoires.
{
  const [masterRules, chronoRules] = SPECIAL_CHALLENGES;
  assert.equal(masterRules.kind, "master");
  assert.equal(chronoRules.kind, "chrono");
  for (const rules of SPECIAL_CHALLENGES) {
    assert.equal(rules.questions, 10);
    assert.equal(rules.maxAttempts, 1);
    assert.equal(rules.jokers, 0);
  }
  assert.equal(masterRules.timeLimitMs, null);
  assert.equal(chronoRules.timeLimitMs, 120_000);

  // Déblocage : tous les niveaux ont un résultat, quel que soit le score.
  assert.equal(areSpecialChallengesUnlocked(["a", "b"], {}), false);
  assert.equal(areSpecialChallengesUnlocked(["a", "b"], { a: {} }), false);
  assert.equal(areSpecialChallengesUnlocked(["a", "b"], { a: {}, b: {} }), true);
  assert.equal(areSpecialChallengesUnlocked([], {}), false, "un territoire vide n'ouvre rien");

  // Réussite à partir de huit.
  assert.equal(isChallengePassed(masterRules, 7), false);
  assert.equal(isChallengePassed(masterRules, 8), true);
  assert.equal(isChallengePassed(masterRules, 10), true);
  assert.equal(isChallengePassed(chronoRules, 10), false, "le Chrono n'a pas de réussite");

  // Records : réussite permanente, bonnes réponses puis temps.
  const at = "2026-11-04T10:00:00.000Z";
  let record = withChallengeResult(undefined, masterRules, { correct: 8, timeMs: null }, at);
  assert.deepEqual(record, { plays: 1, lastCorrect: 8, lastPlayedAt: at, bestCorrect: 8, bestTimeMs: null, passed: true });
  record = withChallengeResult(record, masterRules, { correct: 3, timeMs: null }, at);
  assert.deepEqual(record, { plays: 2, lastCorrect: 3, lastPlayedAt: at, bestCorrect: 8, bestTimeMs: null, passed: true }, "un rejeu moins bon ne retire rien");

  assert.equal(isBetterPerformance({ correct: 7, timeMs: 110_000 }, { correct: 6, timeMs: 40_000 }), true, "les bonnes réponses d'abord");
  assert.equal(isBetterPerformance({ correct: 6, timeMs: 39_000 }, { correct: 6, timeMs: 40_000 }), true, "puis le temps");
  assert.equal(isBetterPerformance({ correct: 6, timeMs: 40_000 }, { correct: 6, timeMs: 40_000 }), false);
  assert.equal(isBetterPerformance({ correct: 5, timeMs: 1_000 }, { correct: 6, timeMs: 40_000 }), false);
  let chrono = withChallengeResult(undefined, chronoRules, { correct: 6, timeMs: 80_000 }, at);
  chrono = withChallengeResult(chrono, chronoRules, { correct: 6, timeMs: 70_000 }, at);
  assert.equal(chrono.bestTimeMs, 70_000);
  chrono = withChallengeResult(chrono, chronoRules, { correct: 4, timeMs: 20_000 }, at);
  assert.deepEqual([chrono.bestCorrect, chrono.bestTimeMs, chrono.lastCorrect, chrono.plays], [6, 70_000, 4, 3], "le temps suit la meilleure partie");
  chrono = withChallengeResult(chrono, chronoRules, { correct: 7, timeMs: 120_000 }, at);
  assert.deepEqual([chrono.bestCorrect, chrono.bestTimeMs], [7, 120_000]);
  assert.equal(chrono.passed, false);

  // Chronomètre : l'arrière-plan et le changement d'heure ne font pas gagner de temps.
  const start = { wall: 1_000_000, monotonic: 500 };
  assert.equal(elapsedMs(start, { wall: 1_030_000, monotonic: 30_500 }), 30_000);
  assert.equal(elapsedMs(start, { wall: 1_090_000, monotonic: 10_500 }), 90_000, "veille : l'horloge monotone peut rester figée");
  assert.equal(elapsedMs(start, { wall: 900_000, monotonic: 45_500 }), 45_000, "horloge reculée à la main");
  assert.equal(elapsedMs(start, { wall: 999_000, monotonic: 400 }), 0);
  assert.equal(remainingMs(120_000, 45_000), 75_000);
  assert.equal(remainingMs(120_000, 500_000), 0);

  // Règles d'une partie de défi : un essai, pas de joker. Les niveaux ne changent pas.
  const bank = levelWith(Array.from({ length: 12 }, (_, i) => question(`s${i}`)));
  const ids = bank.questions.slice(0, 10).map((candidate) => candidate.id);
  const special = startRun(bank, ids, random, masterRules);
  assert.equal(special.jokersLeft, 0);
  assert.equal(canUseJoker(special, bank), false);
  const wrongId = special.answerOrder.find((id) => id !== "a0");
  const wrong = submitAnswer(special, bank, wrongId);
  assert.equal(wrong.state, "failed", "une seule tentative");
  assert.equal(isHintVisible(wrong), false);
  assert.equal(correctCount([{ correct: true }, { correct: false }, { correct: true }]), 2);
  const normal = startRun(bank, ids, random);
  assert.equal(normal.jokersLeft, 2);
  assert.equal(submitAnswer(normal, bank, normal.answerOrder.find((id) => id !== "a0")).state, "playing", "un niveau garde ses deux essais");

  // Banque trop petite : le défi n'est pas proposé, rien n'est inventé.
  const small = { id: "small", levels: [levelWith(Array.from({ length: 9 }, (_, i) => question(`m${i}`, { difficulty: 3 })), 3, 3)] };
  assert.equal(isSpecialChallengeAvailable(small, masterRules), false);
  assert.deepEqual(availableSpecialChallenges({ id: "none", levels: [] }), []);

  // Les vraies questions des territoires publiés, sur de nombreux tirages.
  const alsace = JSON.parse(readFileSync(new URL("../content/fr/territories/alsace.json", import.meta.url), "utf8"));
  assert.deepEqual(availableSpecialChallenges(alsace).map((rules) => rules.kind), ["master", "chrono"]);
  const lorraine = JSON.parse(readFileSync(new URL("../content/fr/territories/lorraine.json", import.meta.url), "utf8"));
  assert.deepEqual(availableSpecialChallenges(lorraine).map((rules) => rules.kind), ["master", "chrono"]);
  const champagneArdenne = JSON.parse(readFileSync(new URL("../content/fr/territories/champagne-ardenne.json", import.meta.url), "utf8"));
  assert.deepEqual(availableSpecialChallenges(champagneArdenne).map((rules) => rules.kind), ["master", "chrono"]);
  const languedocRoussillon = JSON.parse(readFileSync(new URL("../content/fr/territories/languedoc-roussillon.json", import.meta.url), "utf8"));
  assert.deepEqual(availableSpecialChallenges(languedocRoussillon).map((rules) => rules.kind), ["master", "chrono"]);
  const midiPyrenees = JSON.parse(readFileSync(new URL("../content/fr/territories/midi-pyrenees.json", import.meta.url), "utf8"));
  assert.deepEqual(availableSpecialChallenges(midiPyrenees).map((rules) => rules.kind), ["master", "chrono"]);
  // Chaque niveau publié compose une partie complète, sans question répétée.
  for (const level of [...alsace.levels, ...lorraine.levels, ...champagneArdenne.levels, ...languedocRoussillon.levels, ...midiPyrenees.levels]) {
    for (let seed = 0; seed < 100; seed += 1) {
      const drawn = selectQuestions(level, EMPTY_HISTORY, seeded(seed), 8);
      assert.equal(new Set(drawn).size, 8, `partie complète : ${level.id}`);
      const picked = drawn.map((id) => level.questions.find((candidate) => candidate.id === id));
      assert.equal(new Set(picked.map((candidate) => candidate.promptKey)).size, 8, `énoncés distincts : ${level.id}`);
      assert.equal(new Set(picked.map((candidate) => candidate.group ?? candidate.id)).size, 8, `sujets distincts : ${level.id}`);
    }
  }
  for (const [territory, rules] of [alsace, lorraine, champagneArdenne, languedocRoussillon, midiPyrenees].flatMap((territory) => SPECIAL_CHALLENGES.map((rules) => [territory, rules]))) {
    const challengeBank = specialChallengeBank(territory, rules);
    let history = EMPTY_HISTORY;
    for (let seed = 0; seed < 200; seed += 1) {
      const drawn = drawSpecialChallenge(challengeBank, rules, history, EMPTY_HISTORY, seeded(seed));
      assert.equal(drawn.length, 10);
      assert.equal(new Set(drawn).size, 10, "aucun doublon");
      const picked = drawn.map((id) => challengeBank.questions.find((candidate) => candidate.id === id));
      for (const candidate of picked) {
        assert.ok(candidate.difficulty >= rules.minDifficulty && candidate.difficulty <= rules.maxDifficulty, "difficulté du défi");
      }
      assert.equal(new Set(picked.map((candidate) => candidate.promptKey)).size, 10, "aucune question répétée");
      assert.ok(new Set(picked.map((candidate) => candidate.category)).size >= 5, "catégories variées");
      assert.equal(startRun(challengeBank, drawn, seeded(seed), rules).challengeIds, drawn, "questions fixes pendant la partie");
      if (seed < 4) {
        const seen = new Set(Object.keys(history.questions));
        const reused = picked.filter((candidate) => seen.has(candidate.id));
        assert.ok(reused.every((candidate) => candidate.kind !== "choice"), "questions récentes évitées, hors type garanti");
        history = withRunResults(history, drawn.map((challengeId) => ({ challengeId, correct: true, points: 100 })));
      }
    }
  }

  // Défi Maître : difficulté normale à avancée, tous les thèmes de la banque.
  assert.deepEqual([masterRules.minDifficulty, masterRules.maxDifficulty], [2, 3]);
  const masterBank = specialChallengeBank(alsace, masterRules);
  const eligible = masterBank.questions.filter((candidate) => candidate.difficulty >= 2);
  const themes = new Set(eligible.map((candidate) => candidate.category));
  for (const theme of ["geographie", "gastronomie", "patrimoine", "traditions", "savoir-faire", "personnalites"]) assert.ok(themes.has(theme), theme);
  const pickedOf = (ids) => ids.map((id) => masterBank.questions.find((candidate) => candidate.id === id));
  let difficulties = new Set();
  for (let seed = 0; seed < 200; seed += 1) {
    const picked = pickedOf(drawSpecialChallenge(masterBank, masterRules, EMPTY_HISTORY, EMPTY_HISTORY, seeded(seed)));
    assert.equal(new Set(picked.map((candidate) => candidate.category)).size, themes.size, "chaque thème est présent");
    assert.ok(Object.values(Object.groupBy(picked, (candidate) => candidate.category)).every((list) => list.length <= SELECTION_RULES.maxPerCategory), "aucun thème ne domine");
    difficulties = new Set([...difficulties, ...picked.map((candidate) => candidate.difficulty)]);
  }
  assert.deepEqual([...difficulties].sort(), [2, 3], "les deux difficultés sortent");

  // Défi Maître : la dernière partie de niveau est évitée quand la banque permet une autre sélection.
  const lastLevelIds = eligible.slice(0, 8).map((candidate) => candidate.id);
  const lastLevel = withRunResults(withRunResults(EMPTY_HISTORY, [{ challengeId: eligible[9].id, correct: true }]), lastLevelIds.map((challengeId) => ({ challengeId, correct: true })));
  assert.deepEqual([...lastRunQuestions(lastLevel)].sort(), [...lastLevelIds].sort(), "seule la dernière partie compte");
  for (let seed = 0; seed < 100; seed += 1) {
    const drawn = drawSpecialChallenge(masterBank, masterRules, EMPTY_HISTORY, lastLevel, seeded(seed));
    assert.equal(drawn.filter((id) => lastLevelIds.includes(id)).length, 0, "questions du dernier niveau évitées");
  }
  // Une banque tout juste suffisante reprend ces questions plutôt que d'en manquer.
  const tight = levelWith(Array.from({ length: 10 }, (_, i) => question(`t${i}`, { difficulty: 3 })), 3, 2);
  const tightLast = withRunResults(EMPTY_HISTORY, tight.questions.slice(0, 8).map((candidate) => ({ challengeId: candidate.id, correct: true })));
  assert.equal(new Set(drawSpecialChallenge(tight, masterRules, EMPTY_HISTORY, tightLast, seeded(5))).size, 10, "partie complète");
  // Le Chrono ne change pas : il ne lit pas la dernière partie de niveau.
  for (let seed = 0; seed < 20; seed += 1) {
    assert.deepEqual(
      drawSpecialChallenge(specialChallengeBank(alsace, chronoRules), chronoRules, EMPTY_HISTORY, lastLevel, seeded(seed)),
      selectQuestions(specialChallengeBank(alsace, chronoRules), EMPTY_HISTORY, seeded(seed), chronoRules.questions),
    );
  }

  // Niveau joué en dernier, d'après la date.
  assert.equal(lastPlayedLevelId(["a", "b"], {}), null);
  assert.equal(lastPlayedLevelId(["a", "b", "c"], { a: { lastPlayedAt: "2026-11-02T00:00:00.000Z" }, b: { lastPlayedAt: "2026-11-04T00:00:00.000Z" }, c: { lastPlayedAt: "2026-11-03T00:00:00.000Z" } }), "b");

  // Un territoire peut déclarer sa condition de réussite ; le Chrono reste sans échec.
  const strict = { id: "x", levels: alsace.levels, masterPassCorrect: 9 };
  assert.equal(rulesForTerritory(strict, masterRules).passCorrect, 9);
  assert.equal(rulesForTerritory(strict, chronoRules).passCorrect, null);
  assert.equal(rulesForTerritory(alsace, masterRules), masterRules, "l'Alsace garde la règle commune");
  assert.equal(availableSpecialChallenges(strict)[0].passCorrect, 9);
}

// Réinitialisation : seule la portée demandée disparaît, le reste se déduit.
{
  const resetLevel = (id) => ({
    id,
    stars: { one: 0, two: 100, three: 200 },
    questions: Array.from({ length: 5 }, (_, i) => question(`${id}-${i}`, { difficulty: 3 })),
  });
  const card = (id, levelId) => ({ id, unlock: { levelId } });
  const territoryOf = (id, levelIds) => ({
    id,
    status: "published",
    levels: levelIds.map(resetLevel),
    souvenirCards: levelIds.map((levelId) => card(`card-${levelId}`, levelId)),
    badges: [
      { kind: "collection", territoryId: id, cardIds: levelIds.map((levelId) => `card-${levelId}`) },
      { kind: "master", territoryId: id, cardIds: [] },
    ],
  });
  const north = territoryOf("north", ["n1", "n2", "n3"]);
  const south = territoryOf("south", ["s1"]);
  const world = [north, south];
  const run = { bestScore: 300, xp: 40, plays: 2 };
  const records = { n1: run, n2: run, n3: run, s1: run };
  const results = {
    "north:master": { passed: true },
    "north:chrono": { passed: false },
    "south:master": { passed: true },
  };
  const space = {
    levels: records,
    questions: { n1: "h", n2: "h", n3: "h", s1: "h", "north:master": "h", "north:chrono": "h", "south:master": "h" },
    challenges: results,
  };

  // Un niveau : ses résultats et son historique, pas ceux du défi ni des voisins.
  const levelScope = { kind: "level", levelId: "n2" };
  const afterLevel = applyReset(space, resetTargets(levelScope, world));
  assert.deepEqual(Object.keys(afterLevel.levels), ["n1", "n3", "s1"]);
  assert.deepEqual(Object.keys(afterLevel.questions), ["n1", "n3", "s1", "north:master", "north:chrono", "south:master"]);
  assert.deepEqual(afterLevel.challenges, results);
  const levelPreview = previewReset(levelScope, world, records, results);
  assert.deepEqual(
    { ...levelPreview },
    { hasData: true, levels: 1, stars: 3, score: 300, plays: 2, xp: 40, challenges: 0, cards: 1, badges: 1, relockedLevels: 1, relockedChallenges: 1 },
    "carte et badge de collection perdus, niveau suivant et défis reverrouillés, badge Maître conservé",
  );

  // Un territoire : niveaux, défis et historiques des deux, sans toucher au voisin.
  const territoryScope = { kind: "territory", territoryId: "north" };
  const afterTerritory = applyReset(space, resetTargets(territoryScope, world));
  assert.deepEqual(Object.keys(afterTerritory.levels), ["s1"]);
  assert.deepEqual(Object.keys(afterTerritory.questions), ["s1", "south:master"]);
  assert.deepEqual(Object.keys(afterTerritory.challenges), ["south:master"]);
  const territoryPreview = previewReset(territoryScope, world, records, results);
  assert.equal(territoryPreview.xp, 120);
  assert.equal(territoryPreview.challenges, 2);
  assert.equal(territoryPreview.cards, 3);
  assert.equal(territoryPreview.badges, 2, "collection et Maître");
  assert.equal(territoryPreview.relockedLevels, 2, "le premier niveau reste ouvert");
  assert.equal(summarizeCountry(world, afterTerritory.levels).xp, 40, "l'XP restant est celui du voisin");

  // Tout le pays : l'espace repart vide, résultats hors catalogue compris.
  const afterCountry = applyReset({ ...space, levels: { ...records, ancien: run } }, resetTargets({ kind: "country" }, world));
  assert.deepEqual(afterCountry, { levels: {}, questions: {}, challenges: {} });
  assert.equal(previewReset({ kind: "country" }, world, { ancien: run }, {}).hasData, true, "un résultat hors catalogue reste à effacer");

  // Rien à effacer : l'opération le dit, sans rien changer.
  assert.equal(previewReset(levelScope, world, { n1: run }, {}).hasData, false);
  assert.equal(previewReset({ kind: "territory", territoryId: "absent" }, world, records, results).hasData, false);
  assert.deepEqual(applyReset(space, resetTargets({ kind: "territory", territoryId: "absent" }, world)), space);
}

console.log("Moteur de jeu valide.");
