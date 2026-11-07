import createMollieClient, { Locale, MollieApiError, type MollieClient, type Payment } from "@mollie/api-client";
import { centsToDecimal, decimalToCents, type PaymentProvider, type ProviderPayment } from "@/engine/payments";
import { ServerConfigError } from "@/services/firebase/admin";

/**
 * Fournisseur de paiement web : Mollie, API Payments, côté serveur uniquement.
 * Tant que les éditions sont `planned`, seule une clé de test (`test_…`) est acceptée : aucun encaissement réel possible.
 */
let client: MollieClient | null = null;

function mollie(): MollieClient {
  if (client) return client;
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) throw new ServerConfigError("MOLLIE_API_KEY");
  if (!apiKey.startsWith("test_")) throw new ServerConfigError("MOLLIE_API_KEY doit être une clé de test tant que la vente n'est pas validée");
  // Faux Mollie local des tests d'intégration : accepté uniquement avec les émulateurs Firebase, jamais en production.
  const testEndpoint = process.env.FIRESTORE_EMULATOR_HOST ? process.env.MOLLIE_API_ENDPOINT : undefined;
  return (client = createMollieClient(testEndpoint ? { apiKey, apiEndpoint: testEndpoint } : { apiKey }));
}

/** Adresse publique de l'application, utilisée pour le retour du joueur après paiement. */
export function appBaseUrl(): string {
  const url = process.env.APP_BASE_URL;
  if (!url) throw new ServerConfigError("APP_BASE_URL");
  return url.replace(/\/$/, "");
}

/** Mollie ne peut pas joindre une adresse locale : le webhook est alors omis, et la page de retour relit le paiement. */
function webhookUrl(): string | undefined {
  const base = (process.env.PAYMENTS_WEBHOOK_BASE_URL ?? appBaseUrl()).replace(/\/$/, "");
  const host = new URL(base).hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost")) return undefined;
  return `${base}/api/payments/webhook`;
}

function amountOf(amount: { value: string } | undefined): number {
  if (!amount) return 0;
  const cents = decimalToCents(amount.value);
  if (cents === null) throw new Error(`Montant Mollie illisible : ${amount.value}`);
  return cents;
}

function orderIdOf(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const orderId = (metadata as Record<string, unknown>).orderId;
  return typeof orderId === "string" ? orderId : null;
}

function toProviderPayment(payment: Payment): ProviderPayment {
  return {
    id: payment.id,
    status: payment.status,
    amountCents: amountOf(payment.amount),
    currency: payment.amount.currency,
    mode: payment.mode === "live" ? "live" : "test",
    orderId: orderIdOf(payment.metadata),
    refundedCents: amountOf(payment.amountRefunded),
    chargedBackCents: amountOf(payment.amountChargedBack),
  };
}

export const mollieProvider: PaymentProvider = {
  id: "mollie",
  mode: "test",
  async createPayment({ orderId, editionId, amountCents, currency, description, uid }) {
    const base = appBaseUrl();
    const returnUrl = `${base}/boutique/retour?commande=${encodeURIComponent(orderId)}`;
    const payment = await mollie().payments.create({
      amount: { currency, value: centsToDecimal(amountCents) },
      description,
      redirectUrl: returnUrl,
      cancelUrl: returnUrl,
      webhookUrl: webhookUrl(),
      locale: Locale.fr_FR,
      metadata: { orderId, uid, editionId },
      // Une même commande ne crée jamais deux paiements, même si la requête est rejouée.
      idempotencyKey: `order-${orderId}`,
    });
    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) throw new Error("Mollie n'a renvoyé aucune adresse de paiement");
    return { providerPaymentId: payment.id, checkoutUrl };
  },
  async fetchPayment(providerPaymentId) {
    try {
      return toProviderPayment(await mollie().payments.get(providerPaymentId));
    } catch (error) {
      // Paiement inconnu de Mollie : rien à appliquer. Les autres erreurs remontent pour être rejouées.
      if (error instanceof MollieApiError && error.statusCode === 404) return null;
      throw error;
    }
  },
};
