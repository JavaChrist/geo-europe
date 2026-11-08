// Test d'intégration des paiements web : vraies routes API, émulateurs Firebase (Auth, Firestore, règles) et faux Mollie local.
// Aucune clé réelle, aucun appel réseau sortant. Prérequis : `npm run build` (build web), Java 21.
// Usage : npm run test:payments
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:https";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { addDoc, collection, connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const PROJECT = "demo-geofr";
const APP_ID = "geofr";
const PORT = 3112;
const MOLLIE_PORT = 4555;
const SMTP_PORT = 2526;
const BASE = `http://127.0.0.1:${PORT}`;
// Second serveur, sans Firebase Admin configuré : vérifie le 503.
const BARE_PORT = 3113;
const BARE_BASE = `http://127.0.0.1:${BARE_PORT}`;
const CRON_SECRET = "test-cron-secret-0123456789";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!AUTH_HOST || !FIRESTORE_HOST) {
  console.error("Lancer via : npx firebase-tools emulators:exec --project demo-geofr --only auth,firestore \"node scripts/test-payments-emulator.mjs\"");
  process.exit(1);
}

// --- Faux Mollie : API Payments réduite, clé d'idempotence comprise ----------------------------------------------
const payments = new Map();
const byIdempotencyKey = new Map();
let created = 0;
const toJson = (p) => ({
  resource: "payment",
  id: p.id,
  mode: p.mode,
  status: p.status,
  amount: p.amount,
  description: p.description,
  metadata: p.metadata,
  redirectUrl: p.redirectUrl,
  webhookUrl: p.webhookUrl,
  createdAt: new Date().toISOString(),
  ...(p.refunded && { amountRefunded: { value: p.refunded, currency: p.amount.currency } }),
  ...(p.chargedBack && { amountChargedBack: { value: p.chargedBack, currency: p.amount.currency } }),
  _links: { self: { href: `x/${p.id}`, type: "application/hal+json" }, checkout: { href: `https://mollie.test/checkout/${p.id}`, type: "text/html" } },
});
// Le client Mollie n'accepte que https : certificat autosigné jetable, propre à ce test.
const certDir = mkdtempSync(join(tmpdir(), "geofr-mollie-"));
const openssl = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1", "-keyout", join(certDir, "key.pem"), "-out", join(certDir, "cert.pem")], { stdio: "ignore" });
if (openssl.status !== 0) {
  console.error("openssl introuvable : il sert à créer le certificat du faux Mollie.");
  process.exit(1);
}
const tls = { key: readFileSync(join(certDir, "key.pem")), cert: readFileSync(join(certDir, "cert.pem")) };
rmSync(certDir, { recursive: true, force: true });
const mollie = createServer(tls, (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const send = (status, data) => {
      res.writeHead(status, { "content-type": "application/hal+json" });
      res.end(JSON.stringify(data));
    };
    if (!String(req.headers.authorization).startsWith("Bearer test_")) return send(401, { status: 401, title: "Unauthorized" });
    if (req.method === "POST" && req.url === "/v2/payments") {
      const key = req.headers["idempotency-key"];
      if (key && byIdempotencyKey.has(key)) return send(201, toJson(payments.get(byIdempotencyKey.get(key))));
      const input = JSON.parse(body);
      created += 1;
      const payment = { ...input, id: `tr_mock${created}`, mode: "test", status: "open" };
      payments.set(payment.id, payment);
      if (key) byIdempotencyKey.set(key, payment.id);
      return send(201, toJson(payment));
    }
    const match = req.method === "GET" && req.url.match(/^\/v2\/payments\/(tr_[A-Za-z0-9]+)/);
    if (match) return payments.has(match[1]) ? send(200, toJson(payments.get(match[1]))) : send(404, { status: 404, title: "Not Found" });
    send(404, { status: 404, title: "Not Found" });
  });
});
const paymentOfOrder = (orderId) => [...payments.values()].find((p) => p.metadata.orderId === orderId);

// --- Outils ------------------------------------------------------------------------------------------------------
initAdmin({ projectId: PROJECT });
const admin = { auth: adminAuth(), db: adminFirestore() };
const entitlementsOf = async (uid) => (await admin.db.doc(`entitlements/${APP_ID}/users/${uid}`).get()).data() ?? null;
const orderOf = async (id) => (await admin.db.doc(`orders/${id}`).get()).data();

async function identity(path, body) {
  const response = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/${path}?key=demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, returnSecureToken: true }),
  });
  const data = await response.json();
  assert.ok(response.ok, JSON.stringify(data));
  return data;
}
async function newUser(name, { verified = true } = {}) {
  const email = `${name}@example.test`;
  const password = "motdepasse-test";
  const { localId } = await identity("accounts:signUp", { email, password });
  if (verified) await admin.auth.updateUser(localId, { emailVerified: true });
  const { idToken } = await identity("accounts:signInWithPassword", { email, password });
  return { uid: localId, email, password, token: idToken };
}

// --- Faux SMTP : reçoit les courriels envoyés par nodemailer et les garde en mémoire ---------------------------
const CRLF = "\r\n";
const mails = [];
const smtp = createTcpServer((socket) => {
  socket.setEncoding("utf8");
  let buffer = "";
  let data = null;
  let to = [];
  const reply = (line) => socket.write(`${line}${CRLF}`);
  reply("220 faux-smtp");
  socket.on("data", (chunk) => {
    buffer += chunk;
    for (let end = buffer.indexOf(CRLF); end >= 0; end = buffer.indexOf(CRLF)) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (data !== null) {
        if (line === ".") {
          mails.push({ to, raw: data });
          data = null;
          to = [];
          reply("250 OK");
        } else data += `${line.startsWith("..") ? line.slice(1) : line}\n`;
        continue;
      }
      const command = line.slice(0, 4).toUpperCase();
      if (command === "EHLO") socket.write(["250-faux-smtp", "250-AUTH PLAIN", "250 8BITMIME", ""].join(CRLF));
      else if (command === "AUTH") reply("235 OK");
      else if (command === "RCPT") {
        to.push(line.match(/<(.+)>/)?.[1]);
        reply("250 OK");
      } else if (command === "DATA") {
        data = "";
        reply("354 suite");
      } else if (command === "QUIT") {
        reply("221 fin");
        socket.end();
      } else reply("250 OK");
    }
  });
});
/** Courriel lisible : quoted-printable décodé en UTF-8. */
function readable(raw) {
  const text = raw.replace(/=\n/g, "");
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    const hex = text.slice(i + 1, i + 3);
    if (text[i] === "=" && /^[0-9A-F]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else bytes.push(...Buffer.from(text[i], "utf8"));
  }
  return Buffer.from(bytes).toString("utf8");
}
const mailsTo = (email) => mails.filter((mail) => mail.to.includes(email)).map((mail) => readable(mail.raw));

async function api(path, token, body, base = BASE) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
const webhook = (form) => fetch(`${BASE}/api/payments/webhook`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
const consent = { termsAccepted: true, immediateAccessRequested: true, withdrawalWaiverAccepted: true };
const checkout = (user, editionId, extra = {}) => api("/api/payments/checkout", user?.token, { editionId, consent, ...extra });

let passed = 0;
async function test(name, run) {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

// --- Serveur Next (build web) ------------------------------------------------------------------------------------
await new Promise((resolve) => mollie.listen(MOLLIE_PORT, "127.0.0.1", resolve));
await new Promise((resolve) => smtp.listen(SMTP_PORT, "127.0.0.1", resolve));
// Lancé directement par Node, sans shell : l'arrêt en fin de test vise bien le serveur.
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  env: {
    ...process.env,
    FIREBASE_ADMIN_PROJECT_ID: PROJECT,
    MOLLIE_API_KEY: "test_mockkeymockkeymockkeymockke",
    MOLLIE_API_ENDPOINT: `https://127.0.0.1:${MOLLIE_PORT}/v2/`,
    // Uniquement pour ce serveur de test, qui ne parle qu'au faux Mollie local et aux émulateurs.
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    APP_BASE_URL: `http://localhost:${PORT}`,
    PAYMENTS_WEBHOOK_BASE_URL: `http://localhost:${PORT}`,
    CRON_SECRET,
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(SMTP_PORT),
    SMTP_USER: "test",
    SMTP_PASSWORD: "test",
    MAIL_FROM: "GéoFR <no-reply@example.test>",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
next.stdout.on("data", (chunk) => (serverLog += chunk));
next.stderr.on("data", (chunk) => (serverLog += chunk));
for (let attempt = 0; ; attempt += 1) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break;
  } catch {}
  if (attempt > 120) throw new Error(`Serveur Next injoignable\n${serverLog}`);
  await new Promise((resolve) => setTimeout(resolve, 500));
}

try {
  const alice = await newUser("alice");
  const bruno = await newUser("bruno");
  const chloe = await newUser("chloe");
  const david = await newUser("david");
  const nonVerifie = await newUser("non-verifie", { verified: false });

  await test("commande refusée sans compte", async () => {
    const result = await checkout(null, "solo_ads");
    assert.equal(result.status, 401);
    assert.equal(result.body.error, "unauthenticated");
  });

  await test("commande refusée avec une adresse non confirmée", async () => {
    const result = await checkout(nonVerifie, "solo_ads");
    assert.equal(result.status, 403);
    assert.equal(result.body.error, "unverifiedAccount");
  });

  await test("commande refusée sans les deux consentements", async () => {
    const result = await api("/api/payments/checkout", alice.token, { editionId: "solo_ads", consent: { ...consent, withdrawalWaiverAccepted: false } });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, "consentMissing");
  });

  await test("édition gratuite ou inconnue refusée", async () => {
    assert.equal((await checkout(alice, "discovery")).body.error, "notForSale");
    assert.equal((await checkout(alice, "premium")).body.error, "notForSale");
  });

  let aliceOrder;
  await test("prix lu par le serveur, seule l'adresse de paiement est renvoyée", async () => {
    const result = await checkout(alice, "solo_ads", { amountCents: 1, priceCents: 1, price: "0.01" });
    assert.equal(result.status, 200);
    assert.deepEqual(Object.keys(result.body).sort(), ["checkoutUrl", "orderId"]);
    aliceOrder = result.body.orderId;
    const payment = paymentOfOrder(aliceOrder);
    assert.deepEqual(payment.amount, { currency: "EUR", value: "9.99" });
    assert.equal(payment.metadata.uid, alice.uid);
    assert.equal(result.body.checkoutUrl, `https://mollie.test/checkout/${payment.id}`);
    const order = await orderOf(aliceOrder);
    assert.equal(order.amountCents, 999);
    assert.equal(order.status, "open");
    assert.equal(order.consent.termsAccepted, true);
    assert.match(order.consent.termsVersion, /-(draft|reviewed)$/);
  });

  await test("une commande en cours est reprise, jamais doublée", async () => {
    const before = created;
    const result = await checkout(alice, "solo_ads");
    assert.equal(result.body.orderId, aliceOrder);
    assert.equal(created, before, "aucun second paiement Mollie");
  });

  await test("autre édition refusée pendant un paiement en cours", async () => {
    const result = await checkout(alice, "family_ads");
    assert.equal(result.status, 409);
    assert.equal(result.body.error, "otherInProgress");
  });

  await test("retour sans paiement : aucun droit", async () => {
    const result = await api("/api/payments/sync", alice.token, { orderId: aliceOrder });
    assert.equal(result.body.status, "open");
    const rights = await entitlementsOf(alice.uid);
    assert.ok(!rights || rights.fullGameAccess === false);
  });

  await test("notification illisible, mal formée ou inconnue : sans effet", async () => {
    assert.equal((await webhook("")).status, 200);
    assert.equal((await webhook("id=abc")).status, 200);
    assert.equal((await webhook("id=tr_inconnu")).status, 200, "paiement inconnu de Mollie : 200, sans relance");
    assert.equal((await fetch(`${BASE}/api/payments/webhook`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status, 400);
  });

  await test("paiement confirmé par la notification : droits Solo", async () => {
    const payment = paymentOfOrder(aliceOrder);
    payment.status = "paid";
    assert.equal((await webhook(`id=${payment.id}`)).status, 200);
    assert.equal((await orderOf(aliceOrder)).status, "paid");
    const rights = await entitlementsOf(alice.uid);
    assert.equal(rights.fullGameAccess, true);
    assert.equal(rights.familyAccess, false);
    assert.equal(rights.adsRemoved, false);
    assert.deepEqual(rights.editions, ["solo_ads"]);
    assert.equal(rights.app, APP_ID);
  });

  await test("paiement confirmé : une confirmation d'achat, sur le modèle du Mail-Kit", async () => {
    const received = mailsTo(alice.email);
    assert.equal(received.length, 1);
    const [mail] = received;
    assert.match(mail, /Merci pour votre achat/);
    assert.match(mail, new RegExp(aliceOrder));
    assert.match(mail, /9,99/);
    assert.match(mail, /conditions-de-vente/);
    assert.match(mail, /conditions-generales-de-vente-/, "conditions de vente jointes");
    assert.doesNotMatch(mail, /{{/, "aucune variable laissée vide");
    assert.ok((await orderOf(aliceOrder)).confirmation.sentAt, "envoi noté dans la commande");
  });

  await test("notification rejouée : idempotente", async () => {
    const before = await orderOf(aliceOrder);
    const id = paymentOfOrder(aliceOrder).id;
    await webhook(`id=${id}`);
    await webhook(`id=${id}`);
    const after = await orderOf(aliceOrder);
    assert.equal(after.history.length, before.history.length);
    assert.equal(after.updatedAt.toMillis(), before.updatedAt.toMillis());
    assert.equal(mailsTo(alice.email).length, 1, "aucune seconde confirmation");
  });

  await test("second achat bloqué, aucune perte de droits", async () => {
    for (const editionId of ["solo_ads", "family_no_ads", "solo_no_ads"]) {
      const result = await checkout(alice, editionId);
      assert.equal(result.status, 409);
      assert.equal(result.body.error, "upgradeUndefined");
    }
  });

  await test("restauration : droits recalculés depuis les commandes", async () => {
    await admin.db.doc(`entitlements/${APP_ID}/users/${alice.uid}`).delete();
    const result = await api("/api/entitlements/restore", alice.token);
    assert.equal(result.status, 200);
    assert.equal(result.body.fullGameAccess, true);
    assert.equal((await entitlementsOf(alice.uid)).fullGameAccess, true);
  });

  await test("commande d'un autre compte introuvable", async () => {
    assert.equal((await api("/api/payments/sync", bruno.token, { orderId: aliceOrder })).status, 404);
    assert.equal((await api("/api/payments/sync", bruno.token, { orderId: "../x" })).status, 400);
  });

  let brunoOrder;
  await test("montant, devise ou mode falsifiés : aucun droit", async () => {
    brunoOrder = (await checkout(bruno, "family_ads")).body.orderId;
    const payment = paymentOfOrder(brunoOrder);
    payment.status = "paid";
    for (const tamper of [{ amount: { currency: "EUR", value: "0.01" } }, { amount: { currency: "USD", value: "14.99" } }, { mode: "live" }]) {
      const original = { amount: payment.amount, mode: payment.mode };
      Object.assign(payment, tamper);
      await webhook(`id=${payment.id}`);
      assert.notEqual((await orderOf(brunoOrder)).status, "paid");
      const rights = await entitlementsOf(bruno.uid);
      assert.ok(!rights || rights.familyAccess === false);
      Object.assign(payment, original);
    }
    assert.equal(mailsTo(bruno.email).length, 0, "aucune confirmation pour un paiement refusé");
    const mismatches = (await orderOf(brunoOrder)).history.filter((entry) => entry.event === "mismatch").map((entry) => entry.mismatch);
    assert.deepEqual(mismatches, ["amount", "currency", "mode"]);
  });

  await test("paiement d'une autre commande refusé", async () => {
    const stray = { ...paymentOfOrder(brunoOrder), id: "tr_intrus1", status: "paid" };
    payments.set(stray.id, stray);
    await webhook(`id=${stray.id}`);
    assert.notEqual((await orderOf(brunoOrder)).status, "paid");
    payments.delete(stray.id);
  });

  await test("paiement Famille valide : Mode Famille ouvert", async () => {
    await webhook(`id=${paymentOfOrder(brunoOrder).id}`);
    const rights = await entitlementsOf(bruno.uid);
    assert.equal(rights.familyAccess, true);
    assert.equal(rights.fullGameAccess, true);
    assert.equal(mailsTo(bruno.email).length, 1);
  });

  await test("remboursement partiel puis total", async () => {
    const payment = paymentOfOrder(aliceOrder);
    payment.refunded = "1.00";
    await webhook(`id=${payment.id}`);
    let order = await orderOf(aliceOrder);
    assert.equal(order.status, "paid");
    assert.equal(order.partiallyRefunded, true);
    assert.equal(order.refundedCents, 100);
    assert.equal((await entitlementsOf(alice.uid)).fullGameAccess, true, "droits conservés : politique à valider");
    payment.refunded = "9.99";
    await webhook(`id=${payment.id}`);
    order = await orderOf(aliceOrder);
    assert.equal(order.status, "refunded");
    assert.equal((await entitlementsOf(alice.uid)).fullGameAccess, false);
  });

  await test("rétrofacturation : droits retirés", async () => {
    const payment = paymentOfOrder(brunoOrder);
    payment.chargedBack = "14.99";
    await webhook(`id=${payment.id}`);
    assert.equal((await orderOf(brunoOrder)).status, "charged_back");
    const rights = await entitlementsOf(bruno.uid);
    assert.equal(rights.familyAccess, false);
    assert.equal(rights.fullGameAccess, false);
  });

  await test("annulé, échoué, expiré : aucun droit, nouvel achat possible", async () => {
    for (const status of ["canceled", "failed", "expired"]) {
      const { orderId } = (await checkout(chloe, "solo_no_ads")).body;
      paymentOfOrder(orderId).status = status;
      const result = await api("/api/payments/sync", chloe.token, { orderId });
      assert.equal(result.body.status, status);
      const rights = await entitlementsOf(chloe.uid);
      assert.ok(!rights || rights.fullGameAccess === false);
    }
    assert.equal(mailsTo(chloe.email).length, 0, "aucune confirmation sans paiement");
  });

  await test("rattrapage des notifications perdues", async () => {
    const { orderId } = (await checkout(david, "family_no_ads")).body;
    paymentOfOrder(orderId).status = "paid";
    assert.equal((await fetch(`${BASE}/api/payments/reconcile`)).status, 401);
    assert.equal((await fetch(`${BASE}/api/payments/reconcile`, { headers: { authorization: "Bearer mauvais-secret-0123456" } })).status, 401);
    const response = await fetch(`${BASE}/api/payments/reconcile`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    const result = await response.json();
    assert.ok(result.changed >= 1, JSON.stringify(result));
    const rights = await entitlementsOf(david.uid);
    assert.equal(rights.familyAccess, true);
    assert.equal(rights.adsRemoved, true);
    assert.equal(mailsTo(david.email).length, 1, "confirmation envoyée par le rattrapage");
  });

  await test("vérification d'adresse : courriel du Mail-Kit avec le lien Firebase", async () => {
    assert.equal((await api("/api/account/verification", null)).status, 401);
    const invalid = await api("/api/account/verification", "jeton-invalide");
    assert.equal(invalid.status, 401, "jeton invalide : 401, pas 503");
    assert.equal(invalid.body.error, "unauthenticated");
    const result = await api("/api/account/verification", nonVerifie.token);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.sent, true);
    const [mail] = mailsTo(nonVerifie.email);
    assert.match(mail, /mode=verifyEmail/);
    assert.match(mail, /oobCode=/);
    assert.doesNotMatch(mail, /{{/);
    assert.equal((await api("/api/account/verification", nonVerifie.token)).status, 429, "un envoi par minute");
    assert.equal((await api("/api/account/verification", alice.token)).body.sent, false, "adresse déjà vérifiée : rien n'est envoyé");
  });

  await test("mot de passe oublié : même réponse pour une adresse inconnue, limite d'envoi", async () => {
    const before = mails.length;
    assert.equal((await api("/api/account/password-reset", null, { email: "inconnu@example.test" })).status, 200);
    assert.equal(mails.length, before, "aucun courriel pour une adresse inconnue");
    assert.equal((await api("/api/account/password-reset", null, { email: chloe.email })).status, 200);
    const [mail] = mailsTo(chloe.email);
    assert.match(mail, /mode=resetPassword/);
    assert.doesNotMatch(mail, /{{/);
    assert.equal((await api("/api/account/password-reset", null, { email: chloe.email })).status, 429);
    assert.equal((await api("/api/account/password-reset", null, { email: "pas-une-adresse" })).status, 400);
  });

  await test("règles Firestore : lecture de ses seuls droits et commandes, aucune écriture", async () => {
    const app = initializeApp({ apiKey: "demo", projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, "rules");
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
    const db = getFirestore(app);
    const [host, port] = FIRESTORE_HOST.split(":");
    connectFirestoreEmulator(db, host, Number(port));
    const denied = (promise) => assert.rejects(promise, (error) => error.code === "permission-denied");

    await denied(getDoc(doc(db, `entitlements/${APP_ID}/users/${david.uid}`)));
    await signInWithEmailAndPassword(auth, david.email, david.password);
    assert.equal((await getDoc(doc(db, `entitlements/${APP_ID}/users/${david.uid}`))).data().familyAccess, true);
    await denied(getDoc(doc(db, `entitlements/${APP_ID}/users/${alice.uid}`)));
    await denied(setDoc(doc(db, `entitlements/${APP_ID}/users/${david.uid}`), { fullGameAccess: true, familyAccess: true, adsRemoved: true, editions: [] }));
    await denied(setDoc(doc(db, `entitlements/${APP_ID}/users/${chloe.uid}`), { fullGameAccess: true }));
    await denied(addDoc(collection(db, "orders"), { uid: david.uid, app: APP_ID, editionId: "family_no_ads", status: "paid" }));
    await denied(getDoc(doc(db, `orders/${aliceOrder}`)));
    await denied(getDoc(doc(db, "autre/x")));
    await denied(getDoc(doc(db, "mailThrottle/x")));
    await signOut(auth);
  });

  await test("Firebase Admin non configuré : 503 « unavailable », jamais 401, même réponse pour toute adresse", async () => {
    const inherited = { ...process.env };
    delete inherited.FIREBASE_ADMIN_PROJECT_ID;
    const bare = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(BARE_PORT)], {
      env: {
        ...inherited,
        APP_BASE_URL: BARE_BASE,
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(SMTP_PORT),
        SMTP_USER: "test",
        SMTP_PASSWORD: "test",
        MAIL_FROM: "GéoFR <no-reply@example.test>",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let bareLog = "";
    bare.stdout.on("data", (chunk) => (bareLog += chunk));
    bare.stderr.on("data", (chunk) => (bareLog += chunk));
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          if ((await fetch(`${BARE_BASE}/api/health`)).ok) break;
        } catch {}
        if (attempt > 120) throw new Error(`Second serveur Next injoignable\n${bareLog}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      const before = mails.length;
      const verification = await api("/api/account/verification", nonVerifie.token, {}, BARE_BASE);
      assert.equal(verification.status, 503, JSON.stringify(verification.body));
      assert.equal(verification.body.error, "unavailable");
      const order = await api("/api/payments/checkout", alice.token, { editionId: "solo_ads", consent }, BARE_BASE);
      assert.equal(order.status, 503);
      assert.equal(order.body.error, "unavailable");
      const known = await api("/api/account/password-reset", null, { email: bruno.email }, BARE_BASE);
      const unknown = await api("/api/account/password-reset", null, { email: "personne@example.test" }, BARE_BASE);
      assert.equal(known.status, 503);
      assert.deepEqual(known, unknown, "même réponse que le compte existe ou non");
      assert.equal(mails.length, before, "aucun courriel sans configuration");
      assert.match(bareLog, /FIREBASE_ADMIN_PROJECT_ID/, "la cause est journalisée");
      assert.ok(!bareLog.includes(nonVerifie.token) && !bareLog.includes(alice.token), "aucun jeton dans le journal");
    } finally {
      if (process.platform === "win32" && bare.pid) spawnSync("taskkill", ["/pid", String(bare.pid), "/T", "/F"], { stdio: "ignore" });
      else bare.kill();
    }
  });

  await test("journal du serveur : aucun jeton, aucune clé, aucun lien d'action", async () => {
    for (const user of [alice, bruno, chloe, david, nonVerifie]) assert.ok(!serverLog.includes(user.token), `jeton de ${user.email}`);
    assert.ok(!serverLog.includes("test_mockkeymockkeymockkeymockke"), "clé Mollie");
    assert.ok(!serverLog.includes(CRON_SECRET), "secret du rattrapage");
    assert.doesNotMatch(serverLog, /Bearer |oobCode=|PRIVATE KEY/);
  });

  console.log(`\n${passed} tests d'intégration réussis.`);
} catch (error) {
  console.error(error);
  console.error(`\n--- journal du serveur ---\n${serverLog.slice(-4000)}`);
  process.exitCode = 1;
} finally {
  if (process.platform === "win32" && next.pid) spawnSync("taskkill", ["/pid", String(next.pid), "/T", "/F"], { stdio: "ignore" });
  else next.kill();
  mollie.close();
  smtp.close();
  process.exit(process.exitCode ?? 0);
}
