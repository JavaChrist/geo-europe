import content from "@country";
import {
  FieldValue,
  type DocumentReference,
  type Firestore,
  type Timestamp,
  type Transaction,
} from "firebase-admin/firestore";
import {
  computeEntitlements,
  effectiveEntitlements,
  FREE_ENTITLEMENTS,
  isInProgress,
  purchaseCheck,
  type Entitlements,
  type OrderStatus,
  type PurchaseRefusal,
} from "@/engine/entitlements";
import {
  grantApplies,
  normalizeEmail,
  type GrantStatus,
} from "@/engine/grants";
import { findEdition } from "@/engine/editions";
import {
  assessPayment,
  nextOrderStatus,
  type PaymentMismatch,
  type PaymentMode,
  type PaymentProvider,
} from "@/engine/payments";
import {
  assessPlayPurchase,
  editionOfProduct,
  isPlausiblePurchaseToken,
  playNotificationKind,
  voidedStatus,
  type PlayMismatch,
} from "@/engine/google-play";
import { productIdOf } from "@/engine/entitlements";
import type { EditionId } from "@/engine/types";
import { getTranslator, type TranslationKey } from "@/i18n/translator";
import {
  adminAuth,
  adminDb,
  firebaseErrorCode,
  ServiceUnavailableError,
} from "@/services/firebase/admin";
import { sendPurchaseConfirmation } from "@/services/mail/purchase-mail";
import { logServerError } from "@/services/server-log";
import {
  acknowledgePlayPurchase,
  fetchPlayPurchase,
  listVoidedPurchases,
  PLAY_PACKAGE,
  sha256,
  type PlayNotification,
} from "./google-play";
import { mollieProvider } from "./mollie";

/**
 * Commandes et droits d'accès, côté serveur uniquement. Seul ce module écrit dans `orders` et `entitlements` :
 * les règles Firestore interdisent toute écriture depuis le navigateur.
 *
 * - `orders/{orderId}` : une commande par tentative d'achat, avec son historique.
 * - `entitlements/{appId}/users/{uid}` : droits recalculés à partir des commandes encore valables et de l'accès offert,
 *   propres à l'application.
 * - `grants/{appId}/emails/{adresse}` : accès offerts, lus ici, gérés par `src/services/grants.ts`.
 */
const APP_ID = content.country.legal.kitAppId;
const ORDERS = "orders";
const provider: PaymentProvider = mollieProvider;

export const entitlementsRef = (
  db: Firestore,
  uid: string,
): DocumentReference =>
  db.collection("entitlements").doc(APP_ID).collection("users").doc(uid);

/** Liste privée des accès offerts de cette application. Aucune règle Firestore ne l'ouvre au navigateur. */
export const grantsCollection = (db: Firestore) =>
  db.collection("grants").doc(APP_ID).collection("emails");

/** Erreur renvoyée au navigateur sous la forme d'un code, jamais d'un message technique. */
export class PaymentRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code:
      | "unauthenticated"
      | "unverifiedAccount"
      | "invalidRequest"
      | "consentMissing"
      | "notFound"
      | "tooManyAttempts"
      | PurchaseRefusal
      | "alreadyOwned"
      | "forbidden"
      | "invalidEmail"
      | "alreadyGranted"
      | "notGranted"
      | "alreadyDecided"
      | "purchaseRejected",
  ) {
    super(code);
    this.name = "PaymentRequestError";
  }
}

// --- Identité ---------------------------------------------------------------------------------------------------

export interface Buyer {
  uid: string;
  /** Adresse du compte telle que Firebase la connaît, ou `null`. */
  email: string | null;
  /** Compte permanent : Google, ou adresse électronique confirmée. Seul un tel compte peut acheter ou recevoir un accès offert. */
  verified: boolean;
}

/**
 * Codes Firebase qui mettent en cause le jeton ou le compte du joueur : lui seul peut y remédier en se reconnectant.
 * Tout autre échec (identifiants du serveur refusés, réseau, quota) vient du serveur et donne 503.
 */
const INVALID_TOKEN_CODES = new Set([
  "auth/argument-error",
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/user-token-expired",
]);

/**
 * Vérifie le jeton Firebase (signature, expiration, révocation). Un achat exige un compte permanent :
 * Google, ou adresse électronique vérifiée.
 *
 * - jeton absent, invalide, expiré ou révoqué : 401 `unauthenticated` ;
 * - Firebase Admin non configuré (`ServerConfigError`) ou injoignable (`ServiceUnavailableError`) : 503 `unavailable`.
 * Le jeton n'est jamais journalisé.
 */
export async function verifyBuyer(
  request: Request,
  { requireVerified }: { requireVerified: boolean },
): Promise<Buyer> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer (.+)$/.exec(header)?.[1];
  if (!token) throw new PaymentRequestError(401, "unauthenticated");
  // Hors du try : une configuration manquante remonte telle quelle, et n'est pas prise pour un jeton invalide.
  const auth = adminAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(token, true);
  } catch (error) {
    const code = firebaseErrorCode(error);
    if (INVALID_TOKEN_CODES.has(code))
      throw new PaymentRequestError(401, "unauthenticated");
    throw new ServiceUnavailableError("firebase-auth", code);
  }
  const method = decoded.firebase.sign_in_provider;
  const permanent =
    method === "google.com" ||
    (method === "password" && decoded.email_verified === true);
  if (requireVerified && !permanent)
    throw new PaymentRequestError(403, "unverifiedAccount");
  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    verified: permanent,
  };
}

// --- Modèle ----------------------------------------------------------------------------------------------------

export interface Consent {
  termsAccepted: boolean;
  immediateAccessRequested: boolean;
  withdrawalWaiverAccepted: boolean;
}

interface OrderDoc {
  uid: string;
  app: string;
  editionId: EditionId;
  provider: PaymentProvider["id"];
  /** Google Play : empreinte du jeton d'achat rattaché (le jeton lui-même reste dans `playPurchases`, privé). */
  purchaseTokenHash?: string | null;
  /** Google Play : accusé de réception envoyé par le serveur. */
  acknowledged?: boolean;
  mode: PaymentProvider["mode"];
  amountCents: number;
  currency: string;
  status: OrderStatus;
  providerPaymentId: string | null;
  checkoutUrl: string | null;
  refundedCents: number;
  chargedBackCents: number;
  partiallyRefunded: boolean;
  consent: Consent & {
    termsVersion: string;
    acceptedAt: Timestamp | FieldValue;
  };
}

type StoredOrder = OrderDoc & { id: string };

/** Ce que le navigateur peut savoir d'une commande. */
export interface PublicOrder {
  id: string;
  editionId: EditionId;
  status: OrderStatus;
}

const toPublic = (order: StoredOrder): PublicOrder => ({
  id: order.id,
  editionId: order.editionId,
  status: order.status,
});

/** Les détails absents sont omis : Firestore refuse `undefined`, et l'écriture entière échouerait. */
const historyEntry = (
  event: string,
  details: Record<string, unknown> = {},
) => ({
  event,
  at: new Date().toISOString(),
  ...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined)),
});

/** Version des conditions de vente acceptée, celle des documents copiés depuis le Legal Kit. */
const termsVersion = `${content.legalRelease.version}-${content.legalRelease.mode}`;

async function ordersOf(
  uid: string,
  transaction?: Transaction,
): Promise<StoredOrder[]> {
  const query = adminDb()
    .collection(ORDERS)
    .where("uid", "==", uid)
    .where("app", "==", APP_ID);
  const snapshot = transaction
    ? await transaction.get(query)
    : await query.get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as OrderDoc),
  }));
}

/** Accès offert actif rattaché à ce compte. À lire avant toute écriture de la transaction. */
async function hasActiveGrant(
  uid: string,
  transaction: Transaction,
): Promise<boolean> {
  const snapshot = await transaction.get(
    grantsCollection(adminDb())
      .where("uid", "==", uid)
      .where("status", "==", "active")
      .limit(1),
  );
  return !snapshot.empty;
}

/**
 * Écrit les droits effectifs : achats valables, plus l'accès offert. Les deux sources restent distinctes dans le document
 * (`sourceOrderIds`, `granted`) ; un accès offert ne crée jamais de commande.
 */
function writeEntitlements(
  transaction: Transaction,
  uid: string,
  orders: StoredOrder[],
  granted: boolean,
): Entitlements {
  const valid = orders.filter((order) => order.status === "paid");
  const entitlements = effectiveEntitlements(
    computeEntitlements(valid, content.editions),
    granted,
  );
  transaction.set(entitlementsRef(adminDb(), uid), {
    ...entitlements,
    app: APP_ID,
    sourceOrderIds: valid.map((order) => order.id),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return entitlements;
}

// --- Achat -----------------------------------------------------------------------------------------------------

export type CheckoutResult =
  | { checkoutUrl: string; orderId: string }
  | { alreadyPaid: true; orderId: string };

/**
 * Prépare le paiement d'une édition. Le prix est lu dans `content/<pays>/editions.ts`, jamais dans la requête.
 * Un paiement déjà en cours pour la même édition est repris au lieu d'en créer un second.
 */
export async function startCheckout(
  buyer: Buyer,
  editionId: string,
  consent: Consent,
): Promise<CheckoutResult> {
  if (
    !consent.termsAccepted ||
    !consent.immediateAccessRequested ||
    !consent.withdrawalWaiverAccepted
  ) {
    throw new PaymentRequestError(400, "consentMissing");
  }

  // Une reprise peut révéler un paiement abouti, annulé ou expiré : on recommence alors l'examen, deux fois au plus.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const order = await reserveOrder(buyer.uid, editionId, consent);
    if (order.status === "created") return createProviderPayment(order);

    // Paiement déjà créé : on relit son état officiel avant de renvoyer le joueur vers la même page de paiement.
    const synced = await applyPaymentById(order.providerPaymentId ?? "");
    if (synced?.status === "paid")
      return { alreadyPaid: true, orderId: order.id };
    if (synced && isInProgress(synced.status) && order.checkoutUrl)
      return { checkoutUrl: order.checkoutUrl, orderId: order.id };
  }
  throw new PaymentRequestError(409, "otherInProgress");
}

/** Dans une transaction : contrôle de l'achat, puis reprise de la commande en cours ou création d'une nouvelle. */
async function reserveOrder(
  uid: string,
  editionId: string,
  consent: Consent,
): Promise<StoredOrder> {
  const db = adminDb();
  return db.runTransaction(async (transaction) => {
    // Achat Google Play préparé puis abandonné dans la fenêtre de Google : il ne bloque pas un achat sur le web.
    const orders = (await ordersOf(uid, transaction)).filter((order) => !isAbandonedPlayOrder(order));
    const check = purchaseCheck(
      editionId as EditionId,
      orders,
      content.editions,
      await hasActiveGrant(uid, transaction),
    );
    if (!check.allowed)
      throw new PaymentRequestError(
        check.reason === "notForSale" ? 400 : 409,
        check.reason,
      );
    if (check.resumeOrderIndex !== null) {
      const existing = orders[check.resumeOrderIndex];
      if (existing) return existing;
    }

    const edition = findEdition(content.editions, editionId as EditionId);
    const ref = db.collection(ORDERS).doc();
    const order: OrderDoc = {
      uid,
      app: APP_ID,
      editionId: edition.id,
      provider: provider.id,
      mode: provider.mode,
      amountCents: edition.priceCents,
      currency: content.editions.currency,
      status: "created",
      providerPaymentId: null,
      checkoutUrl: null,
      refundedCents: 0,
      chargedBackCents: 0,
      partiallyRefunded: false,
      consent: {
        ...consent,
        termsVersion,
        acceptedAt: FieldValue.serverTimestamp(),
      },
    };
    transaction.create(ref, {
      ...order,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      history: [
        historyEntry("created", {
          amountCents: order.amountCents,
          currency: order.currency,
        }),
      ],
    });
    return { id: ref.id, ...order };
  });
}

async function createProviderPayment(
  order: StoredOrder,
): Promise<CheckoutResult> {
  const ref = adminDb().collection(ORDERS).doc(order.id);
  const { t } = getTranslator();
  try {
    const payment = await provider.createPayment({
      orderId: order.id,
      editionId: order.editionId,
      amountCents: order.amountCents,
      currency: order.currency,
      description: `${content.country.appName} — ${t(`editions.${order.editionId}.name` as TranslationKey)}`,
      uid: order.uid,
    });
    await ref.update({
      status: "open",
      providerPaymentId: payment.providerPaymentId,
      checkoutUrl: payment.checkoutUrl,
      updatedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion(
        historyEntry("paymentCreated", {
          providerPaymentId: payment.providerPaymentId,
        }),
      ),
    });
    return { checkoutUrl: payment.checkoutUrl, orderId: order.id };
  } catch (error) {
    await ref.update({
      status: "error",
      updatedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion(historyEntry("paymentCreationFailed")),
    });
    throw error;
  }
}

// --- Application d'un paiement -----------------------------------------------------------------------------------

export type ApplyOutcome = PublicOrder & {
  changed: boolean;
  mismatch?: PaymentMismatch | PlayMismatch | "secondPurchase";
};

/**
 * Relit le paiement chez le fournisseur, le confronte à la commande, puis met à jour la commande et les droits.
 * Idempotent : appelé dix fois avec le même état, il n'écrit qu'une fois. `null` si le paiement ne correspond à aucune commande.
 */
export async function applyPaymentById(
  providerPaymentId: string,
): Promise<ApplyOutcome | null> {
  const outcome = await applyPayment(providerPaymentId);
  // Paiement confirmé : confirmation d'achat, une seule fois par commande. Un échec d'envoi ne remet pas
  // en cause le paiement enregistré : il est journalisé, et le rattrapage quotidien réessaie.
  if (outcome?.status === "paid") {
    await sendPurchaseConfirmation(outcome.id).catch((error: unknown) =>
      logServerError("confirmation", error, `commande ${outcome.id}`),
    );
  }
  return outcome;
}

async function applyPayment(
  providerPaymentId: string,
): Promise<ApplyOutcome | null> {
  if (!/^tr_[A-Za-z0-9]+$/.test(providerPaymentId)) return null;
  const payment = await provider.fetchPayment(providerPaymentId);
  if (!payment?.orderId) return null;
  const db = adminDb();
  const ref = db.collection(ORDERS).doc(payment.orderId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const order = { id: snapshot.id, ...(snapshot.data() as OrderDoc) };
    if (order.app !== APP_ID) return null;
    const orders = await ordersOf(order.uid, transaction);
    const granted = await hasActiveGrant(order.uid, transaction);

    const assessment = assessPayment(order, payment);
    if (!assessment.ok) {
      // Paiement qui ne correspond pas à la commande : aucun droit, trace conservée pour examen.
      transaction.update(ref, {
        updatedAt: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion(
          historyEntry("mismatch", {
            mismatch: assessment.mismatch,
            providerPaymentId: payment.id,
          }),
        ),
      });
      return {
        ...toPublic(order),
        changed: false,
        mismatch: assessment.mismatch,
      };
    }

    const unchanged =
      assessment.status === order.status &&
      payment.refundedCents === order.refundedCents &&
      payment.chargedBackCents === order.chargedBackCents;
    if (unchanged) return { ...toPublic(order), changed: false };

    const updated: StoredOrder = {
      ...order,
      status: assessment.status,
      refundedCents: payment.refundedCents,
      chargedBackCents: payment.chargedBackCents,
      partiallyRefunded: assessment.partiallyRefunded,
    };
    transaction.update(ref, {
      status: updated.status,
      refundedCents: updated.refundedCents,
      chargedBackCents: updated.chargedBackCents,
      partiallyRefunded: updated.partiallyRefunded,
      ...(updated.status === "paid" &&
        order.status !== "paid" && { paidAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion(
        historyEntry("status", {
          from: order.status,
          to: updated.status,
          providerStatus: payment.status,
          refundedCents: payment.refundedCents,
          chargedBackCents: payment.chargedBackCents,
        }),
      ),
    });
    writeEntitlements(
      transaction,
      order.uid,
      orders.map((candidate) =>
        candidate.id === order.id ? updated : candidate,
      ),
      granted,
    );
    return { ...toPublic(updated), changed: true };
  });
}

/** Relecture d'une commande par son propriétaire, utilisée par la page de retour. */
export async function syncOrder(
  buyer: Buyer,
  orderId: string,
): Promise<PublicOrder> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(orderId))
    throw new PaymentRequestError(400, "invalidRequest");
  const snapshot = await adminDb().collection(ORDERS).doc(orderId).get();
  const order = snapshot.exists
    ? { id: snapshot.id, ...(snapshot.data() as OrderDoc) }
    : null;
  if (!order || order.uid !== buyer.uid || order.app !== APP_ID)
    throw new PaymentRequestError(404, "notFound");
  if (order.provider === "google_play") {
    const token = await playTokenOf(order);
    if (!token) return toPublic(order);
    const outcome = await applyPlayPurchase(productIdOf(APP_ID, order.editionId), token, buyer.uid);
    return "id" in outcome ? toPublic({ ...order, ...outcome }) : toPublic(order);
  }
  if (!order.providerPaymentId) return toPublic(order);
  return (await applyPaymentById(order.providerPaymentId)) ?? toPublic(order);
}

/**
 * Recalcule les droits d'un joueur à la connexion : ses commandes, puis l'accès offert de son adresse.
 * L'adresse doit être confirmée ; elle est comparée sous sa forme normalisée à la liste privée.
 * Un accès en attente est alors rattaché au compte. Un accès rattaché à ce compte sous une autre adresse
 * (adresse du compte modifiée) repasse en attente : seule l'adresse actuelle compte.
 */
export async function restoreEntitlements(buyer: Buyer): Promise<Entitlements> {
  const db = adminDb();
  const email = normalizeEmail(buyer.email);
  return db.runTransaction(async (transaction) => {
    const orders = await ordersOf(buyer.uid, transaction);
    const grantRef = email ? grantsCollection(db).doc(email) : null;
    const grant = grantRef ? await transaction.get(grantRef) : null;
    const linked = await transaction.get(
      grantsCollection(db)
        .where("uid", "==", buyer.uid)
        .where("status", "==", "active"),
    );

    const status = grant?.exists
      ? ((grant.data()?.status as GrantStatus | undefined) ?? null)
      : null;
    const granted = grantApplies(status, buyer.verified);

    if (
      granted &&
      grantRef &&
      (status !== "active" || grant?.data()?.uid !== buyer.uid)
    ) {
      transaction.update(grantRef, {
        status: "active",
        uid: buyer.uid,
        activatedAt: new Date().toISOString(),
        history: FieldValue.arrayUnion(
          historyEntry("activated", { uid: buyer.uid }),
        ),
      });
    }
    for (const other of linked.docs) {
      if (granted && other.id === email) continue;
      transaction.update(other.ref, {
        status: "pending",
        uid: null,
        history: FieldValue.arrayUnion(
          historyEntry("detached", { uid: buyer.uid }),
        ),
      });
    }
    return writeEntitlements(transaction, buyer.uid, orders, granted);
  });
}

/** Recalcule les droits d'un compte après un changement de l'administrateur (ajout ou révocation d'un accès offert). */
export async function recomputeEntitlements(
  uid: string,
): Promise<Entitlements> {
  return adminDb().runTransaction(async (transaction) => {
    const orders = await ordersOf(uid, transaction);
    const granted = await hasActiveGrant(uid, transaction);
    return writeEntitlements(transaction, uid, orders, granted);
  });
}

/**
 * Rattrapage des notifications perdues : commandes en cours, et commandes payées depuis moins de 180 jours
 * pour détecter un remboursement ou une contestation. À appeler par une tâche planifiée.
 */
export async function reconcileOrders(): Promise<{
  checked: number;
  changed: number;
  failed: number;
}> {
  const recent = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const snapshot = await adminDb()
    .collection(ORDERS)
    .where("app", "==", APP_ID)
    .where("status", "in", ["open", "pending", "authorized", "paid"])
    .limit(500)
    .get();
  const candidates = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as OrderDoc & { paidAt?: Timestamp }),
    }))
    .filter(
      (order) =>
        order.provider !== "google_play" &&
        order.providerPaymentId &&
        (order.status !== "paid" || (order.paidAt?.toMillis() ?? 0) >= recent),
    );

  let changed = 0;
  let failed = 0;
  for (const order of candidates) {
    try {
      if ((await applyPaymentById(order.providerPaymentId ?? ""))?.changed)
        changed += 1;
    } catch {
      failed += 1;
    }
  }
  const play = await reconcilePlayOrders();
  return {
    checked: candidates.length + play.checked,
    changed: changed + play.changed,
    failed: failed + play.failed,
  };
}

// --- Google Play Billing (application Android) -------------------------------------------------------------------

/**
 * Mode des achats Google Play acceptés. `test` : seuls les testeurs de licence de la Play Console peuvent acheter,
 * sans débit réel. Un achat réel est refusé (aucun droit, aucun accusé, Google le rembourse) tant que Christian
 * n'a pas validé la vente.
 */
const PLAY_MODE: PaymentMode = "test";
const PLAY_PURCHASES = "playPurchases";

/** Commande Play préparée puis jamais suivie d'un achat (fenêtre de Google fermée) : elle ne bloque rien. */
const isAbandonedPlayOrder = (order: StoredOrder): boolean =>
  order.provider === "google_play" && order.status === "created" && !order.purchaseTokenHash;

const playPurchaseRef = (db: Firestore, tokenHash: string): DocumentReference =>
  db.collection(PLAY_PURCHASES).doc(tokenHash);

/** Jeton d'achat d'une commande Play, conservé à part (`playPurchases`, privé, jamais lu par le navigateur). */
async function playTokenOf(order: StoredOrder): Promise<string | null> {
  if (!order.purchaseTokenHash) return null;
  const snapshot = await playPurchaseRef(adminDb(), order.purchaseTokenHash).get();
  const token = snapshot.data()?.purchaseToken;
  return typeof token === "string" ? token : null;
}

export interface PlayPreparation {
  orderId: string;
  productId: string;
  /** Empreinte du compte, transmise à Google Play et relue par le serveur. */
  obfuscatedAccountId: string;
  /** Identifiant de la commande, transmis à Google Play et relu par le serveur. */
  obfuscatedProfileId: string;
}

/**
 * Prépare un achat Google Play : mêmes contrôles et mêmes consentements que sur le web, un seul achat par compte.
 * La commande enregistre le prix de référence de `editions.ts` ; le prix affiché et payé est celui de la Play Console.
 */
export async function preparePlayOrder(
  buyer: Buyer,
  editionId: string,
  consent: Consent,
): Promise<PlayPreparation> {
  if (!consent.termsAccepted || !consent.immediateAccessRequested || !consent.withdrawalWaiverAccepted)
    throw new PaymentRequestError(400, "consentMissing");
  const db = adminDb();
  const orderId = await db.runTransaction(async (transaction) => {
    const all = await ordersOf(buyer.uid, transaction);
    const granted = await hasActiveGrant(buyer.uid, transaction);
    const abandoned = all.filter(isAbandonedPlayOrder);
    const orders = all.filter((order) => !isAbandonedPlayOrder(order));
    const check = purchaseCheck(editionId as EditionId, orders, content.editions, granted);
    if (!check.allowed)
      throw new PaymentRequestError(check.reason === "notForSale" ? 400 : 409, check.reason);
    if (check.resumeOrderIndex !== null) {
      // Paiement Mollie en cours pour la même édition : il doit aboutir ou expirer sur le web.
      const existing = orders[check.resumeOrderIndex];
      if (existing?.provider !== "google_play") throw new PaymentRequestError(409, "otherInProgress");
      // Achat Play en attente (paiement différé) : Google refusera un second achat du même produit.
      throw new PaymentRequestError(409, "alreadyOwned");
    }

    const edition = findEdition(content.editions, editionId as EditionId);
    // Reprise de la commande abandonnée de la même édition : un achat tardif garde sa référence.
    const reused = abandoned.find((order) => order.editionId === edition.id);
    for (const order of abandoned) {
      if (order.id === reused?.id) continue;
      transaction.update(db.collection(ORDERS).doc(order.id), {
        status: "canceled",
        updatedAt: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion(historyEntry("abandoned")),
      });
    }
    const consentRecord = { ...consent, termsVersion, acceptedAt: FieldValue.serverTimestamp() };
    if (reused) {
      transaction.update(db.collection(ORDERS).doc(reused.id), {
        consent: consentRecord,
        updatedAt: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion(historyEntry("prepared")),
      });
      return reused.id;
    }
    const ref = db.collection(ORDERS).doc();
    const order: OrderDoc = {
      uid: buyer.uid,
      app: APP_ID,
      editionId: edition.id,
      provider: "google_play",
      mode: PLAY_MODE,
      amountCents: edition.priceCents,
      currency: content.editions.currency,
      status: "created",
      providerPaymentId: null,
      checkoutUrl: null,
      refundedCents: 0,
      chargedBackCents: 0,
      partiallyRefunded: false,
      purchaseTokenHash: null,
      acknowledged: false,
      consent: consentRecord,
    };
    transaction.create(ref, {
      ...order,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      history: [historyEntry("created", { amountCents: order.amountCents, currency: order.currency })],
    });
    return ref.id;
  });
  return {
    orderId,
    productId: productIdOf(APP_ID, editionId as EditionId),
    obfuscatedAccountId: sha256(buyer.uid),
    obfuscatedProfileId: orderId,
  };
}

export type PlayOutcome = ApplyOutcome | { unattached: true };

/**
 * Vérifie un achat Google Play auprès de l'API Google Play Developer, puis met à jour la commande et les droits.
 * Seul le relevé de Google compte. Idempotent : un jeton rejoué ne change rien et ne sert jamais un autre compte.
 *
 * - `expectedUid` : compte qui présente le jeton (application) ; `null` pour une notification de Google.
 * - achat sans commande (aucune référence, ou référence inconnue) : `unattached`, jamais accusé, donc remboursé par Google.
 * - écart (compte, commande, produit, mode, jeton déjà rattaché ailleurs) ou second achat : aucun droit, aucun accusé.
 * - achat payé et accepté : droits écrits, puis accusé de réception (sans quoi Google rembourse au bout de 3 jours).
 */
export async function applyPlayPurchase(
  productId: string,
  purchaseToken: string,
  expectedUid: string | null,
): Promise<PlayOutcome> {
  if (!isPlausiblePurchaseToken(purchaseToken) || !editionOfProduct(APP_ID, productId, content.editions))
    throw new PaymentRequestError(400, "invalidRequest");
  const purchase = await fetchPlayPurchase(productId, purchaseToken);
  const orderId = purchase?.obfuscatedExternalProfileId;
  if (!purchase || !orderId || !/^[A-Za-z0-9]{1,40}$/.test(orderId)) return { unattached: true };

  const db = adminDb();
  const ref = db.collection(ORDERS).doc(orderId);
  const tokenHash = sha256(purchaseToken);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const order: StoredOrder = { id: snapshot.id, ...(snapshot.data() as OrderDoc) };
    if (order.app !== APP_ID || order.provider !== "google_play") return null;
    if (expectedUid !== null && order.uid !== expectedUid) throw new PaymentRequestError(403, "forbidden");
    const tokenDoc = await transaction.get(playPurchaseRef(db, tokenHash));
    const orders = await ordersOf(order.uid, transaction);
    const granted = await hasActiveGrant(order.uid, transaction);

    const reject = (mismatch: PlayMismatch | "secondPurchase") => {
      transaction.update(ref, {
        updatedAt: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion(historyEntry("mismatch", { mismatch, tokenHash })),
      });
      return { outcome: { ...toPublic(order), changed: false, mismatch }, acknowledge: false, order };
    };

    const tokenOwner = tokenDoc.exists ? (tokenDoc.data()?.orderId as string | undefined) : undefined;
    if (tokenOwner !== undefined && tokenOwner !== order.id) return reject("token");
    const assessment = assessPlayPurchase(
      {
        id: order.id,
        editionId: order.editionId,
        status: order.status,
        accountHash: sha256(order.uid),
        mode: order.mode,
        purchaseToken: order.purchaseTokenHash ?? null,
      },
      purchase,
      { productId, purchaseToken: tokenHash, appId: APP_ID, config: content.editions },
    );
    if (!assessment.ok) return reject(assessment.mismatch);
    // Un seul achat par compte : un second achat payé n'ouvre rien de plus et n'est pas accusé (Google le rembourse).
    if (
      assessment.status === "paid" &&
      orders.some((other) => other.id !== order.id && other.status === "paid")
    )
      return reject("secondPurchase");

    if (!tokenDoc.exists) {
      transaction.create(playPurchaseRef(db, tokenHash), {
        purchaseToken,
        orderId: order.id,
        uid: order.uid,
        app: APP_ID,
        productId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    const alreadyAcknowledged = purchase.acknowledgementState === 1;
    const unchanged =
      assessment.status === order.status &&
      order.purchaseTokenHash === tokenHash &&
      (order.acknowledged === true) === alreadyAcknowledged;
    if (unchanged) return { outcome: { ...toPublic(order), changed: false }, acknowledge: assessment.acknowledge, order };

    const updated: StoredOrder = {
      ...order,
      status: assessment.status,
      purchaseTokenHash: tokenHash,
      providerPaymentId: purchase.orderId ?? order.providerPaymentId,
      acknowledged: alreadyAcknowledged || order.acknowledged === true,
    };
    transaction.update(ref, {
      status: updated.status,
      purchaseTokenHash: tokenHash,
      providerPaymentId: updated.providerPaymentId,
      acknowledged: updated.acknowledged,
      ...(updated.status === "paid" && order.status !== "paid" && { paidAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion(
        historyEntry("status", {
          from: order.status,
          to: updated.status,
          purchaseState: purchase.purchaseState,
          acknowledgementState: purchase.acknowledgementState,
        }),
      ),
    });
    if (updated.status !== order.status)
      writeEntitlements(
        transaction,
        order.uid,
        orders.map((candidate) => (candidate.id === order.id ? updated : candidate)),
        granted,
      );
    return {
      outcome: { ...toPublic(updated), changed: updated.status !== order.status },
      acknowledge: assessment.acknowledge,
      order: updated,
    };
  });
  if (!result) return { unattached: true };

  if (result.acknowledge) {
    // Hors transaction : l'accusé est un appel réseau. En cas d'échec, le rattrapage quotidien réessaie.
    try {
      await acknowledgePlayPurchase(productId, purchaseToken);
      await ref.update({
        acknowledged: true,
        updatedAt: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion(historyEntry("acknowledged")),
      });
    } catch (error) {
      logServerError("google-play-acknowledge", error, `commande ${orderId}`);
    }
  }
  if (result.outcome.status === "paid" && result.outcome.changed) {
    await sendPurchaseConfirmation(orderId).catch((error: unknown) =>
      logServerError("confirmation", error, `commande ${orderId}`),
    );
  }
  return result.outcome;
}

/**
 * Achat remboursé, annulé ou contesté chez Google : la commande perd ses droits, jamais l'inverse.
 * `unmatched` : jeton ou commande inconnus ici ; `unchanged` : commande déjà sans droits ; `changed` : droits retirés.
 */
export async function markPlayVoided(
  purchaseToken: string,
  voidedReason: number | undefined,
): Promise<"unmatched" | "unchanged" | "changed"> {
  const db = adminDb();
  const tokenSnapshot = await playPurchaseRef(db, sha256(purchaseToken)).get();
  const orderId = tokenSnapshot.data()?.orderId;
  if (typeof orderId !== "string") return "unmatched";
  const ref = db.collection(ORDERS).doc(orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return "unmatched";
    const order: StoredOrder = { id: snapshot.id, ...(snapshot.data() as OrderDoc) };
    const orders = await ordersOf(order.uid, transaction);
    const granted = await hasActiveGrant(order.uid, transaction);
    const proposed = voidedStatus(voidedReason);
    const status = order.status === "paid" ? nextOrderStatus(order.status, proposed) : "canceled";
    if (status === order.status) return "unchanged";
    const updated: StoredOrder = {
      ...order,
      status,
      refundedCents: status === "refunded" ? order.amountCents : order.refundedCents,
      chargedBackCents: status === "charged_back" ? order.amountCents : order.chargedBackCents,
    };
    transaction.update(ref, {
      status,
      refundedCents: updated.refundedCents,
      chargedBackCents: updated.chargedBackCents,
      updatedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion(historyEntry("voided", { from: order.status, to: status, voidedReason })),
    });
    writeEntitlements(
      transaction,
      order.uid,
      orders.map((candidate) => (candidate.id === order.id ? updated : candidate)),
      granted,
    );
    return "changed";
  });
}

/** Notification développeur en temps réel, déjà authentifiée par `verifyPubSubRequest`. */
export async function handlePlayNotification(notification: PlayNotification): Promise<void> {
  if (notification.packageName !== PLAY_PACKAGE) return;
  const oneTime = notification.oneTimeProductNotification;
  if (oneTime?.purchaseToken && oneTime.sku) {
    const kind = playNotificationKind(oneTime.notificationType);
    if (kind !== "other") await applyPlayPurchase(oneTime.sku, oneTime.purchaseToken, null);
    return;
  }
  const voided = notification.voidedPurchaseNotification;
  // `refundType` 1 : remboursement total. Un achat unique n'a pas de remboursement partiel.
  if (voided?.purchaseToken) await markPlayVoided(voided.purchaseToken, undefined);
}

/**
 * Rattrapage Google Play : achats en attente, accusés de réception manqués, puis remboursements et contestations
 * des 30 derniers jours (`voidedpurchases`). Sans identifiants Google Play sur le serveur, rien n'est fait.
 */
async function reconcilePlayOrders(): Promise<{ checked: number; changed: number; failed: number }> {
  if (!process.env.GOOGLE_PLAY_CLIENT_EMAIL) {
    console.info("[google-play-reconcile] ignoré : aucun identifiant Google Play sur le serveur");
    return { checked: 0, changed: 0, failed: 0 };
  }
  const snapshot = await adminDb()
    .collection(ORDERS)
    .where("app", "==", APP_ID)
    .where("status", "in", ["pending", "paid"])
    .limit(500)
    .get();
  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as OrderDoc) }))
    .filter(
      (order) =>
        order.provider === "google_play" &&
        order.purchaseTokenHash &&
        (order.status === "pending" || order.acknowledged !== true),
    );
  let changed = 0;
  let failed = 0;
  for (const order of candidates) {
    try {
      const token = await playTokenOf(order);
      if (!token) continue;
      const outcome = await applyPlayPurchase(productIdOf(APP_ID, order.editionId), token, null);
      if ("changed" in outcome && outcome.changed) changed += 1;
    } catch {
      failed += 1;
    }
  }
  const ordersChanged = changed;
  let voidedCount = 0;
  let voidedMatched = 0;
  let voidedKnownOrders = 0;
  let voidedApplied = 0;
  let voidedRead = true;
  try {
    const voided = await listVoidedPurchases();
    voidedCount = voided.length;
    // Numéros de commande Google (`GPA.…`) connus ici : distingue un remboursement d'un achat GéoFR dont le jeton
    // ne correspond pas, d'une annulation qui ne concerne aucune commande enregistrée.
    const known = await adminDb()
      .collection(ORDERS)
      .where("app", "==", APP_ID)
      .where("provider", "==", "google_play")
      .limit(1000)
      .get();
    const knownOrderIds = new Set(
      known.docs.map((doc) => (doc.data() as OrderDoc).providerPaymentId).filter((id): id is string => !!id),
    );
    voidedKnownOrders = voided.filter((item) => item.orderId && knownOrderIds.has(item.orderId)).length;
    for (const item of voided) {
      try {
        const result = await markPlayVoided(item.purchaseToken, item.voidedReason);
        if (result !== "unmatched") voidedMatched += 1;
        if (result === "changed") voidedApplied += 1;
      } catch {
        failed += 1;
      }
    }
  } catch (error) {
    logServerError("google-play-voided", error, "rattrapage");
    voidedRead = false;
    failed += 1;
  }
  changed += voidedApplied;
  // Compteurs seulement : aucun jeton, identifiant de commande ni compte dans ce journal.
  console.info(
    `[google-play-reconcile] commandes vérifiées ${candidates.length}, modifiées ${ordersChanged} ; ` +
      `annulations Google reçues ${voidedRead ? voidedCount : "illisibles"}, numéros de commande connus ${voidedKnownOrders}, ` +
      `correspondances ${voidedMatched}, ` +
      `appliquées ${voidedApplied} ; échecs ${failed}`,
  );
  return { checked: candidates.length + voidedCount, changed, failed };
}

export { FREE_ENTITLEMENTS };
