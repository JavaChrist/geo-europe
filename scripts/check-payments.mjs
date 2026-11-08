// Vérifie les droits d'accès et la confrontation des paiements, sans réseau. Usage : node scripts/check-payments.mjs
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  canPlayRegion,
  computeEntitlements,
  FREE_ENTITLEMENTS,
  freeRegionIds,
  productIdOf,
  purchaseCheck,
} from "../src/engine/entitlements.ts";
import { describeError, redactSecrets } from "../src/engine/log-safety.ts";
import { assessPayment, centsToDecimal, decimalToCents, nextOrderStatus } from "../src/engine/payments.ts";

// Montants exacts, sans nombre à virgule.
assert.equal(centsToDecimal(999), "9.99");
assert.equal(centsToDecimal(1499), "14.99");
assert.equal(centsToDecimal(1999), "19.99");
assert.equal(centsToDecimal(5), "0.05");
assert.equal(centsToDecimal(100), "1.00");
assert.throws(() => centsToDecimal(9.99));
assert.throws(() => centsToDecimal(-1));
assert.equal(decimalToCents("9.99"), 999);
assert.equal(decimalToCents("19.99"), 1999);
assert.equal(decimalToCents("9.9"), null, "deux décimales exigées");
assert.equal(decimalToCents("9,99"), null);
assert.equal(decimalToCents("-9.99"), null);
for (let cents = 0; cents < 3000; cents += 1) assert.equal(decimalToCents(centsToDecimal(cents)), cents);

for (const code of readdirSync("content").filter((name) => !name.startsWith("_"))) {
  const { editions } = await import(pathToFileURL(resolve(join("content", code, "editions.ts"))).href);
  const priceOf = (id) => editions.editions.find((edition) => edition.id === id).priceCents;
  const order = (editionId, status) => ({ editionId, status });

  // Droits de chaque édition.
  assert.deepEqual(computeEntitlements([], editions), FREE_ENTITLEMENTS);
  assert.deepEqual(computeEntitlements([order("solo_ads", "paid")], editions), { fullGameAccess: true, familyAccess: false, adsRemoved: false, editions: ["solo_ads"] });
  assert.deepEqual(computeEntitlements([order("solo_no_ads", "paid")], editions), { fullGameAccess: true, familyAccess: false, adsRemoved: true, editions: ["solo_no_ads"] });
  assert.deepEqual(computeEntitlements([order("family_ads", "paid")], editions), { fullGameAccess: true, familyAccess: true, adsRemoved: false, editions: ["family_ads"] });
  assert.deepEqual(computeEntitlements([order("family_no_ads", "paid")], editions), { fullGameAccess: true, familyAccess: true, adsRemoved: true, editions: ["family_no_ads"] });
  assert.deepEqual(computeEntitlements([order("discovery", "paid")], editions), FREE_ENTITLEMENTS, "l'édition gratuite ne donne aucun droit payant");

  // Aucun droit sans paiement confirmé.
  for (const status of ["created", "open", "pending", "authorized", "canceled", "expired", "failed", "refunded", "charged_back", "error"]) {
    assert.deepEqual(computeEntitlements([order("family_no_ads", status)], editions), FREE_ENTITLEMENTS, `${status} ne donne aucun droit`);
  }

  // Un remboursement ne retire que les droits de sa commande.
  const mixed = computeEntitlements([order("family_no_ads", "refunded"), order("solo_ads", "paid")], editions);
  assert.deepEqual(mixed, { fullGameAccess: true, familyAccess: false, adsRemoved: false, editions: ["solo_ads"] });

  // Régions gratuites.
  const free = freeRegionIds(editions);
  assert.ok(free.length > 0, `${code} : régions gratuites`);
  assert.equal(canPlayRegion(FREE_ENTITLEMENTS, free[0], editions), true);
  assert.equal(canPlayRegion(FREE_ENTITLEMENTS, "XX-NONE", editions), false);
  assert.equal(canPlayRegion(computeEntitlements([order("solo_ads", "paid")], editions), "XX-NONE", editions), true);

  // Un seul achat par compte, reprise d'un paiement en cours pour la même édition.
  assert.deepEqual(purchaseCheck("solo_ads", [], editions), { allowed: true, resumeOrderIndex: null });
  assert.deepEqual(purchaseCheck("discovery", [], editions), { allowed: false, reason: "notForSale" });
  assert.deepEqual(purchaseCheck("inconnue", [], editions), { allowed: false, reason: "notForSale" });
  assert.deepEqual(purchaseCheck("solo_ads", [order("solo_ads", "paid")], editions), { allowed: false, reason: "upgradeUndefined" }, "doublon refusé");
  assert.deepEqual(purchaseCheck("family_no_ads", [order("solo_ads", "paid")], editions), { allowed: false, reason: "upgradeUndefined" });
  assert.deepEqual(purchaseCheck("solo_ads", [order("family_no_ads", "paid")], editions), { allowed: false, reason: "upgradeUndefined" }, "aucune perte de droits");
  assert.deepEqual(purchaseCheck("solo_ads", [order("solo_ads", "open")], editions), { allowed: true, resumeOrderIndex: 0 });
  assert.deepEqual(purchaseCheck("family_ads", [order("solo_ads", "open")], editions), { allowed: false, reason: "otherInProgress" });
  assert.deepEqual(purchaseCheck("solo_ads", [order("solo_ads", "canceled"), order("solo_ads", "refunded")], editions), { allowed: true, resumeOrderIndex: null });

  // Confrontation du paiement officiel à la commande.
  const stored = { id: "o1", editionId: "solo_ads", status: "open", amountCents: priceOf("solo_ads"), currency: editions.currency, mode: "test", providerPaymentId: "tr_1" };
  const official = { id: "tr_1", status: "paid", amountCents: priceOf("solo_ads"), currency: editions.currency, mode: "test", orderId: "o1", refundedCents: 0, chargedBackCents: 0 };
  assert.deepEqual(assessPayment(stored, official), { ok: true, status: "paid", partiallyRefunded: false });
  assert.deepEqual(assessPayment(stored, { ...official, id: "tr_2" }), { ok: false, mismatch: "paymentId" }, "faux paiement");
  assert.deepEqual(assessPayment(stored, { ...official, orderId: "o2" }), { ok: false, mismatch: "orderId" }, "paiement d'une autre commande");
  assert.deepEqual(assessPayment(stored, { ...official, amountCents: 1 }), { ok: false, mismatch: "amount" }, "prix modifié");
  assert.deepEqual(assessPayment(stored, { ...official, currency: "USD" }), { ok: false, mismatch: "currency" });
  assert.deepEqual(assessPayment(stored, { ...official, mode: "live" }), { ok: false, mismatch: "mode" });
  for (const status of ["open", "pending", "authorized", "canceled", "expired", "failed"]) {
    assert.equal(assessPayment(stored, { ...official, status }).status, status);
  }
  const paidOrder = { ...stored, status: "paid" };
  assert.deepEqual(assessPayment(paidOrder, { ...official, refundedCents: official.amountCents }), { ok: true, status: "refunded", partiallyRefunded: false });
  assert.deepEqual(assessPayment(paidOrder, { ...official, refundedCents: 100 }), { ok: true, status: "paid", partiallyRefunded: true });
  assert.deepEqual(assessPayment(paidOrder, { ...official, chargedBackCents: official.amountCents }), { ok: true, status: "charged_back", partiallyRefunded: false });

  assert.equal(productIdOf("geofr", "solo_no_ads"), "geofr_solo_no_ads");
}

// Une notification en retard ne revient jamais en arrière.
assert.equal(nextOrderStatus("paid", "open"), "paid");
assert.equal(nextOrderStatus("paid", "paid"), "paid");
assert.equal(nextOrderStatus("refunded", "paid"), "refunded");
assert.equal(nextOrderStatus("charged_back", "paid"), "charged_back");
assert.equal(nextOrderStatus("paid", "refunded"), "refunded");
assert.equal(nextOrderStatus("open", "paid"), "paid");

// Journaux du serveur : aucune clé privée, aucun jeton, aucun lien d'action.
{
  const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.c2lnbmF0dXJlLWZhdXNzZQ";
  const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----\n";
  for (const secret of [jwt, pem, "Bearer abc.def.ghi", "test_abcdefghijklmnopqrstuvwxyz12", "live_abcdefghijklmnopqrstuvwxyz12", "oobCode=AbC123xyz"]) {
    const out = redactSecrets(`avant ${secret} après`);
    assert.ok(!out.includes(secret.trim()), `secret masqué : ${secret.slice(0, 12)}`);
    assert.match(out, /^avant \[masqué\]\s*après$/);
  }
  assert.equal(redactSecrets("mot de passe s3cret-tres-long dans le message", ["s3cret-tres-long"]), "mot de passe [masqué] dans le message");
  assert.equal(redactSecrets("court", ["abc"]), "court", "un secret trop court n'est pas cherché");

  // Seuls nom, code et message sont lus : ni la configuration, ni les en-têtes, ni la cause.
  const error = Object.assign(new Error(`Decoding failed for ${jwt}`), {
    code: "auth/argument-error",
    config: { headers: { Authorization: `Bearer ${jwt}` } },
    cause: new Error(pem),
  });
  const line = describeError(error);
  assert.ok(line.startsWith("Error (auth/argument-error) : Decoding failed for [masqué]"), line);
  assert.ok(!line.includes("eyJ") && !line.includes("PRIVATE KEY") && !line.includes("Authorization"));
  assert.ok(describeError(new Error("x".repeat(1000))).length <= 300);
  assert.equal(describeError("texte"), "texte");
  assert.equal(describeError(null), "null");
}

console.log("Droits et paiements valides.");
