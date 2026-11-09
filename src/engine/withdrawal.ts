/**
 * Fonction de rétractation en ligne (directive 2011/83 art. 11 bis, Code de la consommation art. L221-21-1).
 * Logique pure, sans Firebase : le serveur l'applique (voir `docs/retractation.md`). Commune à tous les pays.
 *
 * Toute demande est reçue, enregistrée et confirmée sur support durable. Elle n'est jamais traitée automatiquement :
 * la pré-analyse ci-dessous n'est qu'une indication pour l'examen manuel. Ni remboursement ni retrait de droits ici.
 */

/** Moyens d'achat possibles. Google Play n'a pas encore de commandes côté serveur : examen toujours manuel. */
export const WITHDRAWAL_PROVIDERS = ["mollie", "google_play"] as const;
export type WithdrawalProvider = (typeof WITHDRAWAL_PROVIDERS)[number];

/**
 * - `received` : demande reçue, à examiner ;
 * - `accepted` : rétractation acceptée par l'administrateur, qui rembourse ensuite chez le fournisseur ;
 * - `refused` : rétractation refusée (droit exclu ou délai dépassé), avec une note.
 */
export type WithdrawalStatus = "received" | "accepted" | "refused";

/** Délai légal de rétractation, en jours, à compter de la conclusion du contrat (paiement confirmé). */
export const WITHDRAWAL_PERIOD_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WithdrawalInput {
  name: string;
  email: string;
  provider: WithdrawalProvider;
  /** Numéro de commande tel que saisi, nettoyé : identifiant de commande, de paiement Mollie, ou commande Google Play. */
  orderReference: string;
  message: string;
}

const MAX_NAME = 120;
const MAX_MESSAGE = 1000;
const EMAIL = /^[^\s@/]{1,64}@[^\s@/]{1,255}\.[^\s@/.]{2,63}$/;

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  // Caractères de contrôle retirés, espaces répétés réduits : la saisie est recopiée dans un courriel.
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : null;
};

/**
 * Référence de commande selon le moyen d'achat. `null` si elle n'a pas la forme attendue.
 * - Mollie : identifiant de commande du courriel de confirmation (20 caractères alphanumériques), ou paiement `tr_…` ;
 * - Google Play : numéro de commande `GPA.1234-5678-9012-34567`, éventuellement suivi de `..0`.
 */
export function normalizeOrderReference(provider: WithdrawalProvider, input: unknown): string | null {
  const value = clean(input, 60)?.replace(/\s/g, "");
  if (!value) return null;
  if (provider === "mollie") return /^(tr_)?[A-Za-z0-9]{6,40}$/.test(value) ? value : null;
  return /^GPA\.\d{4}-\d{4}-\d{4}-\d{5}(\.\.\d{1,3})?$/i.test(value) ? value.toUpperCase() : null;
}

/** Lit et valide le formulaire. `null` si un champ obligatoire manque ou n'a pas la bonne forme. */
export function parseWithdrawalInput(raw: Record<string, unknown>): WithdrawalInput | null {
  const name = clean(raw.name, MAX_NAME);
  const email = clean(raw.email, 320)?.toLowerCase();
  const provider = WITHDRAWAL_PROVIDERS.find((candidate) => candidate === raw.provider);
  const message = raw.message === undefined ? "" : clean(raw.message, MAX_MESSAGE);
  if (!name || name.length < 2 || !email || !EMAIL.test(email) || !provider || message === null) return null;
  const orderReference = normalizeOrderReference(provider, raw.orderReference);
  if (!orderReference) return null;
  return { name, email, provider, orderReference, message };
}

/** Ce que le serveur sait de la commande désignée, une fois vérifié qu'elle appartient bien à l'adresse saisie. */
export interface WithdrawalOrderFacts {
  status: string;
  paidAt: number | null;
  immediateAccessRequested: boolean;
  withdrawalWaiverAccepted: boolean;
  /** Confirmation d'achat envoyée sur support durable (art. L221-13), avec l'accord exprès et la renonciation. */
  confirmationSent: boolean;
}

/**
 * Indication pour l'examen manuel, jamais une décision :
 * - `manualReview` : achat Google Play, ou commande non rattachée (numéro inconnu ou adresse différente du compte) ;
 * - `notPaid` : commande sans paiement confirmé, rien à rembourser ;
 * - `alreadyRefunded` : commande déjà remboursée ou contestée ;
 * - `outsidePeriod` : demande reçue plus de 14 jours après le paiement ;
 * - `waiverRecorded` : accord exprès, renonciation et confirmation durable enregistrés : droit probablement exclu (L221-28 13°) ;
 * - `withinPeriod` : dans le délai, sans preuve complète de renonciation : rétractation probablement recevable.
 */
export type WithdrawalAssessment =
  | "manualReview"
  | "notPaid"
  | "alreadyRefunded"
  | "outsidePeriod"
  | "waiverRecorded"
  | "withinPeriod";

export function assessWithdrawal(order: WithdrawalOrderFacts | null, receivedAt: number): WithdrawalAssessment {
  if (!order) return "manualReview";
  if (order.status === "refunded" || order.status === "charged_back") return "alreadyRefunded";
  if (order.status !== "paid" || order.paidAt === null) return "notPaid";
  if (receivedAt - order.paidAt > WITHDRAWAL_PERIOD_DAYS * DAY_MS) return "outsidePeriod";
  if (order.immediateAccessRequested && order.withdrawalWaiverAccepted && order.confirmationSent) return "waiverRecorded";
  return "withinPeriod";
}

/** Une décision n'est prise qu'une fois, sur une demande encore à examiner. */
export function canDecideWithdrawal(status: WithdrawalStatus | null): boolean {
  return status === "received";
}

export const WITHDRAWAL_DECISIONS = ["accepted", "refused"] as const;
export type WithdrawalDecision = (typeof WITHDRAWAL_DECISIONS)[number];

/** Demande telle que l'administration la voit. */
export interface WithdrawalRecord {
  id: string;
  status: WithdrawalStatus;
  name: string;
  email: string;
  provider: WithdrawalProvider;
  orderReference: string;
  message: string;
  receivedAt: string;
  assessment: WithdrawalAssessment;
  /** Commande rattachée, seulement si son compte a la même adresse que la demande. */
  orderId: string | null;
  editionId: string | null;
  paidAt: string | null;
  acknowledgementSentAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}
