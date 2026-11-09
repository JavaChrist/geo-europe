// Vérifie la logique de la fonction de rétractation, sans réseau. Usage : node scripts/check-withdrawal.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessWithdrawal,
  canDecideWithdrawal,
  normalizeOrderReference,
  parseWithdrawalInput,
  WITHDRAWAL_PERIOD_DAYS,
} from "../src/engine/withdrawal.ts";
import { MAIL_VARIABLES } from "../src/engine/mail.ts";

const DAY = 24 * 60 * 60 * 1000;
const valid = { name: "Jeanne Martin", email: "Jeanne@Exemple.fr", provider: "mollie", orderReference: "AbCdEf1234567890XyZw" };

// Formulaire : champs obligatoires, forme des références, nettoyage de la saisie.
assert.deepEqual(parseWithdrawalInput(valid), { ...valid, email: "jeanne@exemple.fr", message: "" });
assert.equal(parseWithdrawalInput({ ...valid, name: "J" }), null, "nom trop court");
assert.equal(parseWithdrawalInput({ ...valid, email: "pas-une-adresse" }), null);
assert.equal(parseWithdrawalInput({ ...valid, provider: "stripe" }), null, "moyen d'achat inconnu");
assert.equal(parseWithdrawalInput({ ...valid, orderReference: "" }), null);
assert.equal(parseWithdrawalInput({ ...valid, message: "x".repeat(1001) }), null);
assert.equal(parseWithdrawalInput({ ...valid, name: "Jeanne\r\nBcc: autre@exemple.fr" }).name, "Jeanne Bcc: autre@exemple.fr", "aucun saut de ligne recopié");
assert.equal(normalizeOrderReference("mollie", "tr_WDqYK6vllg"), "tr_WDqYK6vllg");
assert.equal(normalizeOrderReference("mollie", "../orders/x"), null, "aucun chemin Firestore");
assert.equal(normalizeOrderReference("google_play", "gpa.1234-5678-9012-34567"), "GPA.1234-5678-9012-34567");
assert.equal(normalizeOrderReference("google_play", "GPA.1234-5678-9012-34567..0"), "GPA.1234-5678-9012-34567..0");
assert.equal(normalizeOrderReference("google_play", "AbCdEf1234567890XyZw"), null);

// Pré-analyse : une indication, dans l'ordre des cas.
const paidAt = Date.UTC(2026, 5, 1);
const order = { status: "paid", paidAt, immediateAccessRequested: false, withdrawalWaiverAccepted: false, confirmationSent: true };
assert.equal(assessWithdrawal(null, paidAt), "manualReview", "commande non rattachée ou Google Play");
assert.equal(assessWithdrawal({ ...order, status: "refunded" }, paidAt), "alreadyRefunded");
assert.equal(assessWithdrawal({ ...order, status: "charged_back" }, paidAt), "alreadyRefunded");
assert.equal(assessWithdrawal({ ...order, status: "open", paidAt: null }, paidAt), "notPaid");
assert.equal(assessWithdrawal(order, paidAt + WITHDRAWAL_PERIOD_DAYS * DAY), "withinPeriod", "14e jour inclus");
assert.equal(assessWithdrawal(order, paidAt + WITHDRAWAL_PERIOD_DAYS * DAY + 1), "outsidePeriod");
const waived = { ...order, immediateAccessRequested: true, withdrawalWaiverAccepted: true };
assert.equal(assessWithdrawal(waived, paidAt + DAY), "waiverRecorded");
assert.equal(assessWithdrawal({ ...waived, confirmationSent: false }, paidAt + DAY), "withinPeriod", "sans confirmation durable, pas d'exclusion");

// Décision : une seule fois.
assert.equal(canDecideWithdrawal("received"), true);
assert.equal(canDecideWithdrawal("accepted"), false);
assert.equal(canDecideWithdrawal("refused"), false);

// Le modèle du Mail-Kit contient toutes les variables de l'accusé de réception.
const templates = JSON.parse(readFileSync(new URL("../content/fr/mail/templates.json", import.meta.url), "utf8"));
const receipt = templates.templates["withdrawal-receipt"];
assert.ok(receipt, "modèle withdrawal-receipt synchronisé");
for (const name of MAIL_VARIABLES["withdrawal-receipt"]) {
  assert.ok(JSON.stringify(receipt).includes(`{{ .${name} }}`), `variable ${name} dans le modèle`);
}

console.log("Rétractation valide.");
