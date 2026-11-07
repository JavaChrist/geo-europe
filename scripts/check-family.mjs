// Vérifie le Mode Famille : tirage, tours, barème, jokers, classement, reprise. Usage : node scripts/check-family.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  advanceTurn,
  answerTurn,
  beginTurn,
  createFamilyGame,
  currentPlayer,
  FAMILY_RULES,
  familyGameSize,
  familyPointsFor,
  familyPool,
  familyStandings,
  familyWinners,
  gameQuestions,
  isGameResumable,
  isLastQuestionOfTurn,
  jokerTurn,
  nextRound,
  planFamilyGame,
  playableDurations,
  playerIndexAt,
  roundDifficulties,
  turnPoints,
} from "../src/engine/family.ts";
import { canUseJoker, isHintVisible } from "../src/engine/level-run.ts";
import { family as frFamily } from "../content/fr/family.ts";

// Aléa reproductible : mulberry32.
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const NOW = "2026-11-07T10:00:00.000Z";

const answers = [0, 1, 2, 3].map((i) => ({ id: `a${i}`, labelKey: `k${i}` }));
const question = (id, overrides = {}) => ({
  id, kind: "choice", category: id, difficulty: 1, promptKey: "p", hintKey: "h", anecdoteKey: "x", answerId: "a0", answers, ...overrides,
});
const territory = (id, questions, status = "published") => ({ id, status, levels: [{ id: `${id}-n`, questions }] });
const players = (count) => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Joueur ${i + 1}`, color: "gold" }));

// Barème : sans aide 10, indice 7, 50/50 5, faux 0, plusieurs aides : la valeur la plus basse.
assert.equal(familyPointsFor({ correct: true, attempts: 1, jokerUsed: false }), 10);
assert.equal(familyPointsFor({ correct: true, attempts: 2, jokerUsed: false }), 7);
assert.equal(familyPointsFor({ correct: true, attempts: 1, jokerUsed: true }), 5);
assert.equal(familyPointsFor({ correct: true, attempts: 2, jokerUsed: true }), 5);
assert.equal(familyPointsFor({ correct: false, attempts: 2, jokerUsed: true }), 0);
assert.deepEqual(FAMILY_RULES.rounds, { quick: 3, classic: 5, long: 10 });
assert.deepEqual(FAMILY_RULES.questionsPerTurn, { quick: 5, classic: 3, long: 3 });
assert.deepEqual(FAMILY_RULES.jokers, { quick: 2, classic: 3, long: 5 });
assert.deepEqual(familyGameSize("long", 4), { players: 4, rounds: 10, perTurn: 3 });
assert.equal(FAMILY_RULES.defaultDuration, "classic");

// La difficulté monte au fil des manches.
assert.deepEqual(roundDifficulties(3, [3, 1, 2, 2]), [1, 2, 3]);
assert.deepEqual(roundDifficulties(5, [1, 2, 3]), [1, 1, 2, 2, 3]);
assert.deepEqual(roundDifficulties(4, [2]), [2, 2, 2, 2]);

// Réserve : seuls les territoires publiés, ids et groupes préfixés par le territoire.
{
  const world = [
    territory("a", [question("q1", { category: "plats" }), question("q2", { category: "villes", group: "g" })]),
    territory("b", [question("q1", { category: "plats" })]),
    territory("c", [question("q9")], "draft"),
  ];
  const all = familyPool(world, { kind: "country" }, []);
  assert.deepEqual(all.questions.map((q) => q.id), ["a/q1", "a/q2", "b/q1"], "pas de brouillon, ids uniques");
  assert.equal(all.questions[1].group, "a/g");
  assert.deepEqual(familyPool(world, { kind: "territory", territoryId: "b" }, []).questions.map((q) => q.id), ["b/q1"]);
  const themes = [{ id: "food", nameKey: "t", categories: ["plats"] }];
  assert.deepEqual(familyPool(world, { kind: "theme", themeId: "food" }, themes).questions.map((q) => q.id), ["a/q1", "b/q1"]);
  assert.equal(familyPool(world, { kind: "theme", themeId: "absent" }, themes).questions.length, 0);
}

// Réserve trop petite : pas de partie, pas de question inventée, et une durée plus courte reste proposée.
// Une question ne sert qu'une fois par partie : 2 joueurs en Rapide demandent 3 x 2 x 5 = 30 questions.
{
  const pool = (count, group) =>
    familyPool([territory("s", Array.from({ length: count }, (_, i) => question(`q${i}`, group ? { group: group(i) } : {})))], { kind: "country" }, []);
  const small = pool(7);
  assert.equal(planFamilyGame(small, { players: 2, rounds: 1, perTurn: 3 }, seeded(1)) !== null, true, "6 questions pour 2 x 3");
  assert.equal(planFamilyGame(small, { players: 2, rounds: 1, perTurn: 4 }, seeded(1)), null, "7 questions pour 2 x 4");
  assert.equal(planFamilyGame(small, { players: 2, rounds: 2, perTurn: 2 }, seeded(1)), null, "7 questions pour 2 manches de 4");
  assert.deepEqual(playableDurations(small, 2, seeded(1)), []);
  const medium = pool(45);
  assert.deepEqual(playableDurations(medium, 2, seeded(1)), ["quick", "classic"], "45 questions : la Longue à 2 en demande 60");
  assert.deepEqual(playableDurations(medium, 3, seeded(1)), ["quick", "classic"]);
  assert.deepEqual(playableDurations(medium, 4, seeded(1)), []);
  // Un groupe anti-fuite compte pour une seule question.
  const grouped = pool(8, (i) => `g${i % 4}`);
  assert.equal(planFamilyGame(grouped, { players: 2, rounds: 1, perTurn: 2 }, seeded(1)) !== null, true);
  assert.equal(planFamilyGame(grouped, { players: 2, rounds: 1, perTurn: 3 }, seeded(1)), null);
}

// Les questions récentes ne reviennent que si la réserve manque.
{
  const bank = familyPool([territory("r", Array.from({ length: 12 }, (_, i) => question(`q${i}`)))], { kind: "country" }, []);
  const size = { players: 2, rounds: 1, perTurn: 3 };
  for (let seed = 0; seed < 30; seed++) {
    const first = planFamilyGame(bank, size, seeded(seed)).flat(2);
    const second = planFamilyGame(bank, size, seeded(seed + 100), new Set(first)).flat(2);
    assert.equal(second.some((id) => first.includes(id)), false, "12 questions : aucune reprise");
    const third = planFamilyGame(bank, size, seeded(seed + 200), new Set([...first, ...second])).flat(2);
    assert.equal(new Set(third).size, 6, "réserve épuisée : reprise sans doublon");
  }
}

// Partie simulée sur le vrai contenu de chaque pays : équité, aucune répétition, tous les formats.
const countries = readdirSync("content").filter((name) => !name.startsWith("_"));
for (const code of countries) {
  const dir = join("content", code, "territories");
  const territories = readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")));
  const themes = code === "fr" ? frFamily.themes : (await import(`../content/${code}/family.ts`)).family.themes;
  const scopes = [
    { kind: "country" },
    ...territories.filter((t) => t.status === "published").map((t) => ({ kind: "territory", territoryId: t.id })),
    ...themes.map((theme) => ({ kind: "theme", themeId: theme.id })),
  ];
  const kinds = new Set();
  const playable = { quick: 0, classic: 0, long: 0 };
  for (const scope of scopes) {
    const bank = familyPool(territories, scope, themes);
    for (const [count, duration] of [[2, "quick"], [3, "classic"], [4, "long"]]) {
      const size = familyGameSize(duration, count);
      const plan = planFamilyGame(bank, size, seeded(count * size.rounds));
      // Toute la France suffit à chaque durée ; un parcours ou un thème peut être trop petit, l'écran le signale.
      if (scope.kind === "country") assert.ok(plan, `${code} : ${count} joueurs en ${duration}`);
      if (!plan) continue;
      playable[duration]++;
      assert.equal(plan.length, size.rounds);
      for (const round of plan) {
        assert.equal(round.length, count, "une liste par joueur");
        assert.ok(round.every((ids) => ids.length === size.perTurn), "même nombre de questions pour chacun");
      }
      const ids = plan.flat(2);
      assert.equal(new Set(ids).size, count * size.rounds * size.perTurn, "aucune question en double");
      const byId = new Map(bank.questions.map((q) => [q.id, q]));
      const groups = ids.map((id) => byId.get(id).group ?? id);
      assert.equal(new Set(groups).size, groups.length, "aucun groupe anti-fuite en double");
      for (const round of plan) {
        assert.equal(new Set(round.flat().map((id) => byId.get(id).difficulty)).size, 1, "même difficulté dans la manche");
        for (const id of round.flat()) kinds.add(byId.get(id).kind);
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ["choice", "map", "visual"], `${code} : tous les formats de question servent`);
  console.log(`${code} : ${scopes.length} choix, jouables à 2 en Rapide ${playable.quick}, à 3 en Classique ${playable.classic}, à 4 en Longue ${playable.long}`);
}

// Déroulé complet : 2, 3 et 4 joueurs, jokers, indice, changement de joueur, classement, reprise.
const frTerritories = readdirSync("content/fr/territories").map((name) => JSON.parse(readFileSync(join("content/fr/territories", name), "utf8")));
const frBank = familyPool(frTerritories, { kind: "country" }, frFamily.themes);
const byId = new Map(frBank.questions.map((q) => [q.id, q]));

/** `strategy(round, playerIndex, question)` : "clean", "hint", "joker", "wrong". */
function play(count, duration, strategy, seed = 1, reload = false) {
  const random = seeded(seed);
  const size = familyGameSize(duration, count);
  const plan = planFamilyGame(frBank, size, random);
  let game = createFamilyGame({ id: "g", scope: { kind: "country" }, duration, players: players(count), plan, startedAt: NOW });
  const order = [];
  while (game.phase !== "finished") {
    if (game.phase === "summary") {
      const standings = familyStandings(game);
      assert.equal(standings.length, count, "classement de fin de manche");
      game = nextRound(game);
      continue;
    }
    assert.equal(game.phase, "handoff");
    assert.equal(game.run, null, "rien du tour n'est visible avant la confirmation du joueur");
    const index = playerIndexAt(game);
    order.push(currentPlayer(game).id);
    game = beginTurn(game, frBank, random);
    if (reload) game = JSON.parse(JSON.stringify(game));
    assert.deepEqual(game.run.challengeIds, plan[game.round][index], "chacun ses questions");
    for (let q = 0; q < size.perTurn; q++) {
      assert.equal(game.run.index, q, "les questions du tour s'enchaînent");
      const id = game.run.challengeIds[q];
      const move = strategy(game.round, index, q);
      if (move === "joker") {
        const before = game.run.jokersLeft;
        if (before > 0) {
          game = jokerTurn(game, frBank, random);
          assert.equal(game.run.jokersLeft, before - 1);
          assert.ok(game.run.removed.length > 0);
          assert.equal(canUseJoker(game.run, frBank), false, "un seul 50/50 par question");
        } else assert.equal(canUseJoker(game.run, frBank), false, "jokers épuisés");
      }
      if (move === "hint" || move === "wrong") {
        game = answerTurn(game, frBank, game.run.answerOrder.find((a) => a !== byId.get(id).answerId && !game.run.removed.includes(a)));
        assert.equal(isHintVisible(game.run), true, "l'indice suit la première erreur");
      }
      if (move === "wrong") {
        game = answerTurn(game, frBank, game.run.answerOrder.find((a) => a !== byId.get(id).answerId && !game.run.tried.includes(a) && !game.run.removed.includes(a)));
      } else game = answerTurn(game, frBank, byId.get(id).answerId);
      assert.equal(isLastQuestionOfTurn(game), q === size.perTurn - 1);
      assert.equal(turnPoints(game), game.run.results.reduce((sum, result) => sum + familyPointsFor(result), 0));
      if (reload) {
        game = JSON.parse(JSON.stringify(game));
        assert.equal(isGameResumable(game, frBank), true);
      }
      const before = game.turns.length;
      game = advanceTurn(game, frBank, random, NOW);
      // Les réponses n'entrent au classement qu'à la fin du tour.
      assert.equal(game.turns.length, q === size.perTurn - 1 ? before + size.perTurn : before);
    }
    assert.notEqual(game.phase, "playing", "le tour est fini après sa dernière question");
  }
  assert.equal(game.turns.length, count * size.rounds * size.perTurn, "questions = joueurs x manches x questions par tour");
  assert.equal(isGameResumable(game, frBank), false, "une partie terminée ne reprend pas");
  return { game, order };
}

{
  // 2 joueurs, 3 manches de 5 questions, sans aide : égalité parfaite, deux vainqueurs.
  const { game, order } = play(2, "quick", () => "clean");
  const standings = familyStandings(game);
  assert.deepEqual(standings.map((row) => [row.points, row.rank]), [[150, 1], [150, 1]]);
  assert.equal(familyWinners(standings).length, 2, "ex æquo");
  assert.deepEqual(order, ["p0", "p1", "p1", "p0", "p0", "p1"], "le premier joueur change à chaque manche");
}
{
  // 3 joueurs, 5 manches de 3 questions : barèmes différents par joueur.
  const strategies = ["clean", "hint", "wrong"];
  const { game } = play(3, "classic", (_round, index) => strategies[index], 2);
  const standings = familyStandings(game);
  assert.deepEqual(standings.map((row) => [row.player.id, row.points, row.rank, row.correct, row.hints]), [
    ["p0", 150, 1, 15, 0],
    ["p1", 105, 2, 15, 15],
    ["p2", 0, 3, 0, 0],
  ]);
}
{
  // 4 joueurs, 10 manches de 3 questions, 50/50 à chaque question : 5 jokers par joueur, puis plus rien.
  const { game } = play(4, "long", () => "joker", 3);
  for (const row of familyStandings(game)) {
    assert.equal(row.jokers, FAMILY_RULES.jokers.long, "consommation par joueur");
    assert.equal(row.points, FAMILY_RULES.jokers.long * 5 + (30 - FAMILY_RULES.jokers.long) * 10);
  }
  assert.ok(game.players.every((player) => player.jokersLeft === 0));
  assert.equal(gameQuestions(game).length, 120, "4 joueurs en Longue : 120 questions différentes");
}
{
  // Reprise : l'état sérialisé à chaque étape donne la même partie qu'une partie sans rechargement.
  const strategy = (round, _index, q) => (round === 1 && q === 2 ? "hint" : "clean");
  const plain = play(3, "quick", strategy, 4);
  const reloaded = play(3, "quick", strategy, 4, true);
  assert.deepEqual(familyStandings(reloaded.game), familyStandings(plain.game));
  assert.equal(gameQuestions(plain.game).length, 45);
  // Un contenu modifié depuis : la partie ne reprend pas.
  const broken = { ...plain.game, finishedAt: null, plan: [[["absent/q"]]] };
  assert.equal(isGameResumable(broken, frBank), false);
}

// Garde-fous.
const ids = (n) => Array.from({ length: n }, (_, i) => `q${i}`);
const planOf = (count, perTurn) => [0, 1, 2].map(() => Array.from({ length: count }, () => ids(perTurn)));
const create = (count, plan) => createFamilyGame({ id: "x", scope: { kind: "country" }, duration: "quick", players: players(count), plan, startedAt: NOW });
assert.doesNotThrow(() => create(2, planOf(2, 5)));
assert.throws(() => create(1, planOf(1, 5)));
assert.throws(() => create(5, planOf(5, 5)));
assert.throws(() => create(2, planOf(2, 1)), "une question par tour ne suffit plus");
assert.throws(() => create(2, planOf(3, 5)));

console.log("Mode Famille valide.");
