// Vérifie la logique des accès offerts et leur réunion avec les achats, sans réseau. Usage : node scripts/check-grants.mjs
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  computeEntitlements,
  effectiveEntitlements,
  FREE_ENTITLEMENTS,
  purchaseCheck,
} from "../src/engine/entitlements.ts";
import {
  canAddGrant,
  canRevokeGrant,
  grantApplies,
  normalizeEmail,
} from "../src/engine/grants.ts";

// Normalisation : une seule forme par adresse, rien d'autre n'est réécrit.
assert.equal(
  normalizeEmail("  Jean.Dupont@Exemple.FR "),
  "jean.dupont@exemple.fr",
);
assert.equal(
  normalizeEmail("a+geo@gmail.com"),
  "a+geo@gmail.com",
  "l'étiquette Gmail est gardée",
);
assert.equal(normalizeEmail("ÉLODIE@exemple.fr"), "élodie@exemple.fr");
assert.equal(
  normalizeEmail("Élodie@exemple.fr"),
  "élodie@exemple.fr",
  "Unicode normalisé (NFC)",
);
for (const invalid of [
  "",
  "   ",
  "sans-arobase",
  "a@b",
  "a@@b.fr",
  "a b@c.fr",
  "a@b.fr/x",
  ".a@b.fr",
  "a..b@c.fr",
  "a@b.",
  null,
  undefined,
  42,
]) {
  assert.equal(
    normalizeEmail(invalid),
    null,
    `adresse refusée : ${String(invalid)}`,
  );
}
assert.equal(
  normalizeEmail(`${"a".repeat(250)}@b.fr`),
  null,
  "254 caractères au plus",
);

// Un accès ne vaut que pour une adresse confirmée, et tant qu'il n'est pas révoqué.
assert.equal(grantApplies("pending", true), true);
assert.equal(grantApplies("active", true), true);
assert.equal(grantApplies("revoked", true), false);
assert.equal(grantApplies(null, true), false, "adresse non autorisée");
assert.equal(grantApplies("pending", false), false, "adresse non vérifiée");
assert.equal(grantApplies("active", false), false);

// Pas de doublon ; une adresse révoquée peut être ajoutée de nouveau.
assert.equal(canAddGrant(null), true);
assert.equal(canAddGrant("revoked"), true);
assert.equal(canAddGrant("pending"), false);
assert.equal(canAddGrant("active"), false);
assert.equal(canRevokeGrant("pending"), true);
assert.equal(canRevokeGrant("active"), true);
assert.equal(canRevokeGrant("revoked"), false);
assert.equal(canRevokeGrant(null), false);

for (const code of readdirSync("content").filter(
  (name) => !name.startsWith("_"),
)) {
  const { editions: config } = await import(
    pathToFileURL(resolve(join("content", code, "editions.ts"))).href
  );

  // Droits effectifs : accès offert = Famille complète sans publicité, sans inventer d'achat.
  const offered = effectiveEntitlements(FREE_ENTITLEMENTS, true);
  assert.deepEqual(offered, {
    fullGameAccess: true,
    familyAccess: true,
    adsRemoved: true,
    editions: [],
    granted: true,
  });
  assert.deepEqual(
    effectiveEntitlements(FREE_ENTITLEMENTS, false),
    FREE_ENTITLEMENTS,
  );

  // Un achat réel reste visible avec l'accès offert, et intact après la révocation.
  const paid = config.editions.find(
    (edition) => edition.purchase !== "free" && edition.ads === true,
  );
  assert.ok(paid, "une édition payante avec publicité existe");
  const purchased = computeEntitlements(
    [{ editionId: paid.id, status: "paid" }],
    config,
  );
  const both = effectiveEntitlements(purchased, true);
  assert.deepEqual(both.editions, [paid.id]);
  assert.equal(both.adsRemoved, true);
  assert.equal(both.familyAccess, true);
  const afterRevocation = effectiveEntitlements(purchased, false);
  assert.deepEqual(afterRevocation, { ...purchased, granted: false });
  assert.equal(
    afterRevocation.adsRemoved,
    false,
    "la révocation rend les droits de l'achat, pas plus",
  );

  // Aucun achat n'est proposé à un bénéficiaire.
  for (const edition of config.editions.filter(
    (candidate) => candidate.purchase === "one_time",
  )) {
    const check = purchaseCheck(edition.id, [], config, true);
    assert.deepEqual(check, { allowed: false, reason: "offeredAccess" });
  }
}

console.log("Accès offerts valides.");
