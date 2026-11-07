import { readFileSync } from "node:fs";
import { join } from "node:path";
import content from "@country";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { formatAmount, formatPurchaseDate } from "@/engine/mail";
import type { EditionId } from "@/engine/types";
import { getTranslator, type TranslationKey } from "@/i18n/translator";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import { appBaseUrl } from "@/services/payments/mollie";
import { sendTemplateMail, type Attachment } from "./smtp";

/**
 * Confirmation d'achat sur support durable, envoyée une seule fois par commande payée.
 * Un envoi est d'abord réservé dans la commande (`confirmation.claimedAt`), puis marqué `confirmation.sentAt` :
 * deux notifications simultanées n'envoient pas deux courriels. Un envoi échoué libère la réservation,
 * et le rattrapage quotidien réessaie.
 */
const CLAIM_TIMEOUT_MS = 10 * 60_000;
const termsVersion = `${content.legalRelease.version}-${content.legalRelease.mode}`;

interface ConfirmableOrder {
  uid: string;
  editionId: EditionId;
  amountCents: number;
  currency: string;
  status: string;
  paidAt?: Timestamp;
  consent?: { termsVersion?: string };
  confirmation?: { claimedAt?: number; sentAt?: Timestamp };
}

const history = (event: string) => ({ event, at: new Date().toISOString() });

/** Conditions de vente jointes au courriel, seulement si elles sont celles que le joueur a acceptées. */
function termsAttachment(acceptedVersion: string | undefined): Attachment[] {
  if (acceptedVersion !== termsVersion) return [];
  try {
    const text = readFileSync(join(process.cwd(), "content", content.country.code, "legal", "conditions-vente.md"), "utf8");
    return [{ filename: `conditions-generales-de-vente-${termsVersion}.txt`, content: text, contentType: "text/plain; charset=utf-8" }];
  } catch {
    return [];
  }
}

/** `true` si un courriel est parti à cet appel. */
export async function sendPurchaseConfirmation(orderId: string): Promise<boolean> {
  const db = adminDb();
  const ref = db.collection("orders").doc(orderId);
  const order = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as ConfirmableOrder | undefined;
    if (!data || data.status !== "paid" || data.confirmation?.sentAt) return null;
    const claimedAt = data.confirmation?.claimedAt ?? 0;
    if (Date.now() - claimedAt < CLAIM_TIMEOUT_MS) return null;
    transaction.update(ref, { "confirmation.claimedAt": Date.now() });
    return data;
  });
  if (!order) return false;

  try {
    const { email } = await adminAuth().getUser(order.uid);
    if (!email) {
      await ref.update({ "confirmation.claimedAt": FieldValue.delete(), history: FieldValue.arrayUnion(history("confirmationNoEmail")) });
      return false;
    }
    const { t } = getTranslator();
    const locale = content.country.defaultLocale;
    const base = appBaseUrl();
    await sendTemplateMail(
      "purchase-confirmation",
      email,
      {
        ProductName: `${content.country.appName} — ${t(`editions.${order.editionId}.name` as TranslationKey)}`,
        Amount: formatAmount(order.amountCents, order.currency, locale),
        PurchaseDate: formatPurchaseDate(order.paidAt?.toDate() ?? new Date(), locale, content.country.timeZone),
        OrderId: orderId,
        TermsURL: `${base}/profil/confidentialite/conditions-de-vente`,
        SiteURL: base,
      },
      termsAttachment(order.consent?.termsVersion),
    );
    await ref.update({
      "confirmation.sentAt": FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion(history("confirmationSent")),
    });
    return true;
  } catch (error) {
    await ref
      .update({ "confirmation.claimedAt": FieldValue.delete(), history: FieldValue.arrayUnion(history("confirmationFailed")) })
      .catch(() => undefined);
    throw error;
  }
}
