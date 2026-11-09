import content from "@country";
import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { formatReceivedAt } from "@/engine/mail";
import {
  assessWithdrawal,
  canDecideWithdrawal,
  parseWithdrawalInput,
  WITHDRAWAL_DECISIONS,
  type WithdrawalAssessment,
  type WithdrawalInput,
  type WithdrawalOrderFacts,
  type WithdrawalProvider,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "@/engine/withdrawal";
import { normalizeEmail } from "@/engine/grants";
import type { EditionId } from "@/engine/types";
import { getTranslator, type TranslationKey } from "@/i18n/translator";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import type { Admin } from "@/services/grants";
import { allowSend, releaseQuietly, type SendSlot } from "@/services/mail/account-mail";
import { sendTemplateMail } from "@/services/mail/smtp";
import { appBaseUrl } from "@/services/payments/mollie";
import { PaymentRequestError } from "@/services/payments/orders";
import { logServerError } from "@/services/server-log";

/**
 * Fonction de rétractation en ligne, côté serveur uniquement (voir `docs/retractation.md`).
 *
 * - `withdrawals/{appId}/requests/{id}` : une demande par envoi du formulaire, avec sa date de réception serveur.
 *   Les règles Firestore refusent cette collection au navigateur.
 * - Une commande n'est rattachée que si elle appartient à cette application ET si l'adresse de son compte est celle
 *   saisie. La réponse au navigateur ne dit jamais si une commande a été trouvée.
 * - Rien n'est automatique : ni remboursement, ni retrait de droits. L'administrateur décide, puis rembourse
 *   lui-même chez Mollie ; le webhook recalcule alors les droits. Google Play se traite dans la Play Console.
 */
const APP_ID = content.country.legal.kitAppId;
const CLAIM_TIMEOUT_MS = 10 * 60_000;
const MAX_LISTED = 500;
const MAX_NOTE = 1000;

const requests = () => adminDb().collection("withdrawals").doc(APP_ID).collection("requests");

interface WithdrawalDoc {
  app: string;
  status: WithdrawalStatus;
  name: string;
  email: string;
  provider: WithdrawalProvider;
  orderReference: string;
  message: string;
  receivedAt: Timestamp;
  assessment: WithdrawalAssessment;
  orderId: string | null;
  editionId: EditionId | null;
  paidAt: Timestamp | null;
  acknowledged: boolean;
  acknowledgement?: { claimedAt?: number; sentAt?: Timestamp; internalCopySentAt?: Timestamp };
  decidedAt?: Timestamp;
  decidedBy?: string;
  decisionNote?: string;
}

const history = (event: string, details: Record<string, unknown> = {}) => ({
  event,
  at: new Date().toISOString(),
  ...details,
});

// --- Rattachement de la commande ---------------------------------------------------------------------------------

interface LinkedOrder {
  id: string;
  ref: DocumentReference;
  editionId: EditionId;
  paidAt: Timestamp | null;
  facts: WithdrawalOrderFacts;
}

interface OrderData {
  uid?: string;
  app?: string;
  editionId?: EditionId;
  status?: string;
  paidAt?: Timestamp;
  consent?: { immediateAccessRequested?: boolean; withdrawalWaiverAccepted?: boolean };
  confirmation?: { sentAt?: Timestamp };
}

/**
 * Commande Mollie désignée par son identifiant (celui du courriel de confirmation) ou par le paiement `tr_…`.
 * `null` si elle n'existe pas, relève d'une autre application, ou si son compte n'a pas l'adresse saisie.
 */
async function findOwnedOrder(input: WithdrawalInput): Promise<LinkedOrder | null> {
  if (input.provider !== "mollie") return null;
  const orders = adminDb().collection("orders");
  let snapshot;
  if (input.orderReference.startsWith("tr_")) {
    const found = await orders
      .where("providerPaymentId", "==", input.orderReference)
      .where("app", "==", APP_ID)
      .limit(1)
      .get();
    snapshot = found.docs[0];
  } else {
    const doc = await orders.doc(input.orderReference).get();
    snapshot = doc.exists ? doc : undefined;
  }
  const data = snapshot?.data() as OrderData | undefined;
  if (!snapshot || !data || data.app !== APP_ID || !data.uid || !data.editionId) return null;

  let accountEmail: string | null = null;
  try {
    accountEmail = normalizeEmail((await adminAuth().getUser(data.uid)).email ?? "");
  } catch {
    return null;
  }
  if (!accountEmail || accountEmail !== normalizeEmail(input.email)) return null;

  return {
    id: snapshot.id,
    ref: snapshot.ref,
    editionId: data.editionId,
    paidAt: data.paidAt ?? null,
    facts: {
      status: data.status ?? "",
      paidAt: data.paidAt?.toMillis() ?? null,
      immediateAccessRequested: data.consent?.immediateAccessRequested === true,
      withdrawalWaiverAccepted: data.consent?.withdrawalWaiverAccepted === true,
      confirmationSent: Boolean(data.confirmation?.sentAt),
    },
  };
}

// --- Dépôt d'une demande -----------------------------------------------------------------------------------------

export interface SubmittedWithdrawal {
  requestId: string;
  receivedAt: string;
  acknowledgementSent: boolean;
}

/** Adresse IP du client, seulement pour la limite d'envoi : elle n'est jamais stockée en clair. */
function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

/**
 * Enregistre la demande puis envoie l'accusé de réception. La demande est conservée même si l'envoi échoue :
 * le rattrapage planifié réessaie. Limite : par adresse, 1 par minute et 5 par heure ; par IP, 20 par heure.
 */
export async function submitWithdrawal(request: Request, raw: Record<string, unknown>): Promise<SubmittedWithdrawal> {
  const input = parseWithdrawalInput(raw);
  if (!input) throw new PaymentRequestError(400, "invalidRequest");

  const slots: SendSlot[] = [];
  const emailSlot = await allowSend("withdrawal", input.email);
  if (!emailSlot) throw new PaymentRequestError(429, "tooManyAttempts");
  slots.push(emailSlot);
  const ip = clientIp(request);
  if (ip) {
    const ipSlot = await allowSend("withdrawal-ip", ip, { minIntervalMs: 0, maxPerWindow: 20 });
    if (!ipSlot) {
      await releaseQuietly(emailSlot);
      throw new PaymentRequestError(429, "tooManyAttempts");
    }
    slots.push(ipSlot);
  }

  let id: string;
  const receivedAt = new Date();
  try {
    const order = await findOwnedOrder(input);
    const ref = requests().doc();
    id = ref.id;
    const doc: WithdrawalDoc & { history: unknown[] } = {
      app: APP_ID,
      status: "received",
      ...input,
      receivedAt: Timestamp.fromDate(receivedAt),
      assessment: assessWithdrawal(order?.facts ?? null, receivedAt.getTime()),
      orderId: order?.id ?? null,
      editionId: order?.editionId ?? null,
      paidAt: order?.paidAt ?? null,
      acknowledged: false,
      history: [history("received")],
    };
    await ref.set(doc);
    if (order) {
      // Trace dans la commande, sans rien changer à son statut ni aux droits.
      await order.ref
        .update({ history: FieldValue.arrayUnion(history("withdrawalRequested", { requestId: id })) })
        .catch((error: unknown) => logServerError("withdrawal-order-history", error));
    }
  } catch (error) {
    await Promise.all(slots.map(releaseQuietly));
    throw error;
  }

  let acknowledgementSent = false;
  try {
    acknowledgementSent = await sendWithdrawalAcknowledgement(id);
  } catch (error) {
    logServerError("withdrawal-acknowledgement", error, id);
  }
  return { requestId: id, receivedAt: receivedAt.toISOString(), acknowledgementSent };
}

// --- Accusé de réception -----------------------------------------------------------------------------------------

function mailValues(id: string, data: WithdrawalDoc): Record<string, string> {
  const { t } = getTranslator();
  return {
    ReceivedAt: formatReceivedAt(data.receivedAt.toDate(), content.country.defaultLocale, content.country.timeZone),
    RequestId: id,
    CustomerName: data.name,
    CustomerEmail: data.email,
    PaymentMethod: t(`withdrawal.providers.${data.provider}` as TranslationKey, { appName: content.country.appName }),
    OrderReference: data.orderReference,
    Message: data.message || t("withdrawal.noMessage"),
    TermsURL: `${appBaseUrl()}/profil/confidentialite/conditions-de-vente`,
  };
}

/**
 * Accusé de réception sur support durable, une seule fois par demande : réservation (`acknowledgement.claimedAt`),
 * envoi, puis `acknowledgement.sentAt`. Une copie part au support. `true` si l'accusé est parti à cet appel.
 */
export async function sendWithdrawalAcknowledgement(id: string): Promise<boolean> {
  const db = adminDb();
  const ref = requests().doc(id);
  const data = await db.runTransaction(async (transaction) => {
    const stored = (await transaction.get(ref)).data() as WithdrawalDoc | undefined;
    if (!stored || stored.acknowledged) return null;
    if (Date.now() - (stored.acknowledgement?.claimedAt ?? 0) < CLAIM_TIMEOUT_MS) return null;
    transaction.update(ref, { "acknowledgement.claimedAt": Date.now() });
    return stored;
  });
  if (!data) return false;

  const values = mailValues(id, data);
  try {
    await sendTemplateMail("withdrawal-receipt", data.email, values);
  } catch (error) {
    await ref
      .update({
        "acknowledgement.claimedAt": FieldValue.delete(),
        history: FieldValue.arrayUnion(history("acknowledgementFailed")),
      })
      .catch(() => undefined);
    throw error;
  }
  await ref.update({
    acknowledged: true,
    "acknowledgement.sentAt": FieldValue.serverTimestamp(),
    history: FieldValue.arrayUnion(history("acknowledgementSent")),
  });

  // Copie interne : son échec ne remet pas en cause l'accusé du consommateur.
  const support = process.env.MAIL_REPLY_TO ?? content.country.legal.supportEmail;
  try {
    await sendTemplateMail("withdrawal-receipt", support, values);
    await ref.update({ "acknowledgement.internalCopySentAt": FieldValue.serverTimestamp() });
  } catch (error) {
    logServerError("withdrawal-internal-copy", error, id);
  }
  return true;
}

/** Rattrapage des accusés non partis (SMTP indisponible au moment de la demande). Appelé par la tâche planifiée. */
export async function retryWithdrawalAcknowledgements(): Promise<{ sent: number; failed: number }> {
  const snapshot = await requests().where("acknowledged", "==", false).limit(100).get();
  let sent = 0;
  let failed = 0;
  for (const doc of snapshot.docs) {
    try {
      if (await sendWithdrawalAcknowledgement(doc.id)) sent += 1;
    } catch (error) {
      failed += 1;
      logServerError("withdrawal-acknowledgement-retry", error, doc.id);
    }
  }
  return { sent, failed };
}

// --- Administration ----------------------------------------------------------------------------------------------

const iso = (value: unknown): string | null => (value instanceof Timestamp ? value.toDate().toISOString() : null);

function toRecord(id: string, data: WithdrawalDoc): WithdrawalRecord {
  return {
    id,
    status: data.status,
    name: data.name,
    email: data.email,
    provider: data.provider,
    orderReference: data.orderReference,
    message: data.message,
    receivedAt: iso(data.receivedAt) ?? "",
    assessment: data.assessment,
    orderId: data.orderId,
    editionId: data.editionId,
    paidAt: iso(data.paidAt),
    acknowledgementSentAt: iso(data.acknowledgement?.sentAt),
    decidedAt: iso(data.decidedAt),
    decisionNote: data.decisionNote ?? null,
  };
}

export async function listWithdrawals(): Promise<WithdrawalRecord[]> {
  const snapshot = await requests().orderBy("receivedAt", "desc").limit(MAX_LISTED).get();
  return snapshot.docs.map((doc) => toRecord(doc.id, doc.data() as WithdrawalDoc));
}

/**
 * Décision de l'administrateur, une seule fois par demande. N'agit ni sur la commande ni sur les droits :
 * le remboursement se fait à la main chez Mollie ou dans la Play Console.
 */
export async function decideWithdrawal(
  admin: Admin,
  id: unknown,
  decision: unknown,
  note: unknown,
): Promise<WithdrawalRecord> {
  if (typeof id !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(id)) throw new PaymentRequestError(400, "invalidRequest");
  const chosen = WITHDRAWAL_DECISIONS.find((candidate) => candidate === decision);
  const text = typeof note === "string" ? note.replace(/\s+/g, " ").trim() : "";
  if (!chosen || text.length > MAX_NOTE) throw new PaymentRequestError(400, "invalidRequest");

  const ref = requests().doc(id);
  await adminDb().runTransaction(async (transaction) => {
    const stored = (await transaction.get(ref)).data() as WithdrawalDoc | undefined;
    if (!stored) throw new PaymentRequestError(404, "notFound");
    if (!canDecideWithdrawal(stored.status)) throw new PaymentRequestError(409, "alreadyDecided");
    transaction.update(ref, {
      status: chosen,
      decidedAt: FieldValue.serverTimestamp(),
      decidedBy: admin.uid,
      decisionNote: text,
      history: FieldValue.arrayUnion(history(chosen, { by: admin.uid })),
    });
  });
  return toRecord(id, (await ref.get()).data() as WithdrawalDoc);
}
