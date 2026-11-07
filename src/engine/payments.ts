import type { OrderStatus } from "./entitlements.ts";
import type { EditionId } from "./types.ts";

/**
 * Logique de paiement commune à tous les fournisseurs (Mollie sur le web, plus tard Google Play et Apple).
 * Les montants restent des entiers en centimes : aucun nombre à virgule n'est jamais calculé.
 */

/** 999 → "9.99", le format exact attendu par Mollie. */
export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error(`Montant invalide : ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** "9.99" → 999. `null` pour toute autre écriture, sans arrondi. */
export function decimalToCents(value: string): number | null {
  const match = /^(\d{1,9})\.(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2]);
}

export type PaymentProviderId = "mollie" | "google_play" | "apple";
export type PaymentMode = "test" | "live";

/** État d'un paiement relu chez le fournisseur, jamais transmis par le navigateur. */
export interface ProviderPayment {
  id: string;
  status: "open" | "pending" | "authorized" | "paid" | "canceled" | "expired" | "failed";
  amountCents: number;
  currency: string;
  mode: PaymentMode;
  /** Commande indiquée dans les métadonnées du paiement. */
  orderId: string | null;
  refundedCents: number;
  chargedBackCents: number;
}

/** Ce que le serveur a enregistré au moment de créer la commande. */
export interface OrderReference {
  id: string;
  editionId: EditionId;
  status: OrderStatus;
  amountCents: number;
  currency: string;
  mode: PaymentMode;
  providerPaymentId: string | null;
}

export type PaymentMismatch = "paymentId" | "orderId" | "amount" | "currency" | "mode";

export type PaymentAssessment =
  | { ok: true; status: OrderStatus; partiallyRefunded: boolean }
  | { ok: false; mismatch: PaymentMismatch };

/**
 * Confronte le paiement officiel à la commande enregistrée et en déduit le nouvel état de la commande.
 * Le moindre écart refuse le paiement : aucun droit n'est alors attribué.
 */
export function assessPayment(order: OrderReference, payment: ProviderPayment): PaymentAssessment {
  if (order.providerPaymentId !== payment.id) return { ok: false, mismatch: "paymentId" };
  if (payment.orderId !== order.id) return { ok: false, mismatch: "orderId" };
  if (payment.amountCents !== order.amountCents) return { ok: false, mismatch: "amount" };
  if (payment.currency !== order.currency) return { ok: false, mismatch: "currency" };
  if (payment.mode !== order.mode) return { ok: false, mismatch: "mode" };

  const partiallyRefunded = payment.refundedCents > 0 && payment.refundedCents < order.amountCents;
  let status: OrderStatus = payment.status;
  if (payment.status === "paid" && payment.chargedBackCents > 0) status = "charged_back";
  else if (payment.status === "paid" && payment.refundedCents >= order.amountCents) status = "refunded";
  return { ok: true, status: nextOrderStatus(order.status, status), partiallyRefunded };
}

/** Une commande remboursée ou contestée ne redevient jamais payée, même si une notification ancienne arrive en retard. */
export function nextOrderStatus(current: OrderStatus, proposed: OrderStatus): OrderStatus {
  if (current === "refunded" || current === "charged_back") return current;
  if (current === "paid" && proposed !== "refunded" && proposed !== "charged_back") return current;
  return proposed;
}

/** Interface à respecter par chaque fournisseur. Le web l'implémente avec Mollie, côté serveur uniquement. */
export interface PaymentProvider {
  id: PaymentProviderId;
  mode: PaymentMode;
  /** Crée le paiement d'une commande déjà enregistrée et renvoie l'adresse de paiement du fournisseur. */
  createPayment(input: {
    orderId: string;
    editionId: EditionId;
    amountCents: number;
    currency: string;
    description: string;
    uid: string;
  }): Promise<{ providerPaymentId: string; checkoutUrl: string }>;
  /** Relit l'état officiel d'un paiement chez le fournisseur. `null` quand il ne connaît pas ce paiement. */
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment | null>;
}
