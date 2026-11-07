// Vérifie le Mode Famille : tirage, tours, barème, jokers, classement, reprise. Usage : node scripts/check-family.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  answerTurn,
  beginTurn,
  createFamilyGame,
  currentPlayer,
  endTurn,
  FAMILY_RULES,
  familyPointsFor,
  familyPool,
  familyStandings,
  familyWinners,
  gameQuestions,
  isGameResumable,
  jokerTurn,
  nextRound,
  planFamilyGame,
  playableDurations,
  playerIndexAt,
  roundDifficulties,
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
{
  const small = familyPool([territory("s", Array.from({ length: 7 }, (_, i) => question(`q${i}`)))], { kind: "country" }, []);
  assert.equal(planFamilyGame(small, 2, 3, seeded(1)) !== null, true, "6 questions pour 2 x 3");
  assert.equal(planFamilyGame(small, 2, 5, seeded(1)), null, "7 questions pour 2 x 5");
  assert.equal(planFamilyGame(small, 4, 3, seeded(1)), null);
  assert.deepEqual(playableDurations(small, 2, seeded(1)), ["quick"]);
  assert.deepEqual(playableDurations(small, 4, seeded(1)), []);
  // Un groupe anti-fuite compte pour une seule question.
  const grouped = familyPool([territory("g", Array.from({ length: 8 }, (_, i) => question(`q${i}`, { group: `g${i % 4}` })))], { kind: "country" }, []);
  assert.equal(planFamilyGame(grouped, 2, 2, seeded(1)) !== null, true);
  assert.equal(planFamilyGame(grouped, 2, 3, seeded(1)), null);
}

// Les questions récentes ne reviennent que si la réserve manque.
{
  const bank = familyPool([territory("r", Array.from({ length: 12 }, (_, i) => question(`q${i}`)))], { kind: "country" }, []);
  for (let seed = 0; seed < 30; seed++) {
    const first = planFamilyGame(bank, 2, 3, seeded(seed));
    const second = planFamilyGame(bank, 2, 3, seeded(seed + 100), new Set(first.flat()));
    assert.equal(second.flat().some((id) => first.flat().includes(id)), false, "12 questions : aucune reprise");
    const third = planFamilyGame(bank, 2, 3, seeded(seed + 200), new Set([...first.flat(), ...second.flat()]));
    assert.equal(new Set(third.flat()).size, 6, "réserve épuisée : reprise sans doublon");
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
  for (const scope of scopes) {
    const bank = familyPool(territories, scope, themes);
    for (const [count, rounds] of [[2, 3], [3, 5], [4, 10]]) {
      const plan = planFamilyGame(bank, count, rounds, seeded(count * rounds));
      assert.ok(plan, `${code} ${JSON.stringify(scope)} : ${count} joueurs, ${rounds} manches`);
      assert.equal(plan.length, rounds);
      assert.equal(new Set(plan.flat()).size, count * rounds, "aucune question en double");
      const byId = new Map(bank.questions.map((q) => [q.id, q]));
      const groups = plan.flat().map((id) => byId.get(id).group);
      assert.equal(new Set(groups).size, groups.length, "aucun groupe anti-fuite en double");
      for (const round of plan) {
        assert.equal(new Set(round.map((id) => byId.get(id).difficulty)).size, 1, "même difficulté dans la manche");
        for (const id of round) kinds.add(byId.get(id).kind);
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ["choice", "map", "visual"], `${code} : tous les formats de question servent`);
}

// Déroulé complet : 2, 3 et 4 joueurs, jokers, indice, changement de joueur, classement, reprise.
const frTerritories = readdirSync("content/fr/territories").map((name) => JSON.parse(readFileSync(join("content/fr/territories", name), "utf8")));
const frBank = familyPool(frTerritories, { kind: "country" }, frFamily.themes);
const byId = new Map(frBank.questions.map((q) => [q.id, q]));

/** `strategy(round, playerIndex)` : "clean", "hint", "joker", "wrong". */
function play(count, duration, strategy, seed = 1, reload = false) {
  const random = seeded(seed);
  const plan = planFamilyGame(frBank, count, FAMILY_RULES.rounds[duration], random);
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
    const id = game.run.challengeIds[0];
    assert.equal(id, plan[game.round][index], "chacun sa question");
    const move = strategy(game.round, index);
    if (move === "joker") {
      const before = game.players[index].jokersLeft;
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
    if (move === "wrong") game = answerTurn(game, frBank, game.run.answerOrder.find((a) => a !== byId.get(id).answerId && !game.run.tried.includes(a) && !game.run.removed.includes(a)));
    else game = answerTurn(game, frBank, byId.get(id).answerId);
    if (reload) {
      game = JSON.parse(JSON.stringify(game));
      assert.equal(isGameResumable(game, frBank), true);
    }
    game = endTurn(game, NOW);
  }
  assert.equal(game.turns.length, count * FAMILY_RULES.rounds[duration], "questions = joueurs x manches");
  assert.equal(isGameResumable(game, frBank), false, "une partie terminée ne reprend pas");
  return { game, order };
}

{
  // 2 joueurs, 3 manches, sans aide : égalité parfaite, deux vainqueurs.
  const { game, order } = play(2, "quick", () => "clean");
  const standings = familyStandings(game);
  assert.deepEqual(standings.map((row) => [row.points, row.rank]), [[30, 1], [30, 1]]);
  assert.equal(familyWinners(standings).length, 2, "ex æquo");
  assert.deepEqual(order, ["p0", "p1", "p1", "p0", "p0", "p1"], "le premier joueur change à chaque manche");
}
{
  // 3 joueurs, 5 manches : barèmes différents par joueur.
  const strategies = ["clean", "hint", "wrong"];
  const { game } = play(3, "classic", (_round, index) => strategies[index], 2);
  const standings = familyStandings(game);
  assert.deepEqual(standings.map((row) => [row.player.id, row.points, row.rank, row.correct, row.hints]), [
    ["p0", 50, 1, 5, 0],
    ["p1", 35, 2, 5, 5],
    ["p2", 0, 3, 0, 0],
  ]);
}
{
  // 4 joueurs, 10 manches, 50/50 à chaque tour : 3 jokers par joueur, puis plus rien.
  const { game } = play(4, "long", () => "joker", 3);
  for (const row of familyStandings(game)) {
    assert.equal(row.jokers, FAMILY_RULES.jokers.long, "consommation par joueur");
    assert.equal(row.points, FAMILY_RULES.jokers.long * 5 + (10 - FAMILY_RULES.jokers.long) * 10);
  }
  assert.ok(game.players.every((player) => player.jokersLeft === 0));
}
{
  // Reprise : l'état sérialisé à chaque étape donne la même partie qu'une partie sans rechargement.
  const plain = play(3, "quick", (round) => (round === 1 ? "hint" : "clean"), 4);
  const reloaded = play(3, "quick", (round) => (round === 1 ? "hint" : "clean"), 4, true);
  assert.deepEqual(familyStandings(reloaded.game), familyStandings(plain.game));
  assert.equal(gameQuestions(plain.game).length, 9);
  // Un contenu modifié depuis : la partie ne reprend pas.
  const broken = { ...plain.game, finishedAt: null, plan: [["absent/q"]] };
  assert.equal(isGameResumable(broken, frBank), false);
}

// Garde-fous.
assert.throws(() => createFamilyGame({ id: "x", scope: { kind: "country" }, duration: "quick", players: players(1), plan: [[], [], []], startedAt: NOW }));
assert.throws(() => createFamilyGame({ id: "x", scope: { kind: "country" }, duration: "quick", players: players(5), plan: [[], [], []], startedAt: NOW }));

console.log("Mode Famille valide.");
