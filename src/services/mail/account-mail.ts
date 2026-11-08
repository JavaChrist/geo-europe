import { createHash } from "node:crypto";
import content from "@country";
import type { ActionCodeSettings } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb, firebaseErrorCode, ServiceUnavailableError } from "@/services/firebase/admin";
import { appBaseUrl } from "@/services/payments/mollie";
import { PaymentRequestError, type Buyer } from "@/services/payments/orders";
import { logServerError } from "@/services/server-log";
import { assertMailConfigured, sendTemplateMail } from "./smtp";

/**
 * Courriels de compte envoyés par le serveur avec les modèles du Mail-Kit, à la place de ceux de Firebase.
 * Firebase Admin crée le lien d'action ; la page qui l'applique reste celle de Firebase Authentication.
 */
const APP_ID = content.country.legal.kitAppId;
const MIN_INTERVAL_MS = 60_000;
const WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 5;

/** Retour sur l'application après le clic dans le courriel. */
const actionSettings = (): ActionCodeSettings => ({ url: `${appBaseUrl()}/connexion` });

/**
 * Limite d'envoi par adresse : un courriel par minute, cinq par heure. La clé est une empreinte :
 * aucune adresse en clair n'est stockée. `mailThrottle` n'est lisible ni modifiable depuis le navigateur.
 */
async function allowSend(kind: string, address: string): Promise<boolean> {
  const key = createHash("sha256").update(`${APP_ID}:${kind}:${address.trim().toLowerCase()}`).digest("hex");
  const ref = adminDb().collection("mailThrottle").doc(key);
  return adminDb().runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data() as { lastAt: number; windowStart: number; count: number } | undefined;
    const now = Date.now();
    if (data && now - data.lastAt < MIN_INTERVAL_MS) return false;
    const sameWindow = data && now - data.windowStart < WINDOW_MS;
    if (sameWindow && data.count >= MAX_PER_WINDOW) return false;
    transaction.set(ref, {
      lastAt: now,
      windowStart: sameWindow ? data.windowStart : now,
      count: sameWindow ? data.count + 1 : 1,
      // Pour une règle de durée de vie Firestore éventuelle : rien n'est utile au-delà d'une journée.
      expireAt: Timestamp.fromMillis(now + 24 * 60 * 60_000),
    });
    return true;
  });
}

/** Lien de vérification de l'adresse du compte connecté. Rien n'est envoyé si l'adresse est déjà vérifiée. */
export async function sendVerificationMail(buyer: Buyer): Promise<{ sent: boolean }> {
  const user = await adminAuth().getUser(buyer.uid);
  if (!user.email || user.emailVerified) return { sent: false };
  if (!(await allowSend("verify", user.email))) throw new PaymentRequestError(429, "tooManyAttempts");
  const link = await adminAuth().generateEmailVerificationLink(user.email, actionSettings());
  await sendTemplateMail("confirmation", user.email, { ConfirmationURL: link, SiteURL: appBaseUrl() });
  return { sent: true };
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/;

/**
 * Réinitialisation du mot de passe. Même réponse que le compte existe ou non, pour ne rien révéler :
 * - la configuration (Firebase Admin, SMTP) est contrôlée avant toute recherche du compte, donc un 503 vaut pour toutes les adresses ;
 * - adresse inconnue : aucun envoi, réponse normale ;
 * - échec d'envoi pour un compte existant : journalisé, réponse normale aussi, sinon l'échec trahirait le compte.
 */
export async function sendPasswordResetMail(email: string): Promise<void> {
  if (!EMAIL.test(email) || email.length > 320) throw new PaymentRequestError(400, "invalidRequest");
  assertMailConfigured();
  const auth = adminAuth();
  if (!(await allowSend("reset", email))) throw new PaymentRequestError(429, "tooManyAttempts");
  let link: string;
  try {
    link = await auth.generatePasswordResetLink(email, actionSettings());
  } catch (error) {
    const code = firebaseErrorCode(error);
    if (code === "auth/user-not-found" || code === "auth/email-not-found") return;
    // Échec du serveur, identique quelle que soit l'adresse : 503 sans détail.
    throw new ServiceUnavailableError("firebase-auth", code);
  }
  try {
    await sendTemplateMail("reset-password", email, { ConfirmationURL: link, SiteURL: appBaseUrl() });
  } catch (error) {
    // Ni l'adresse ni le lien ne sont journalisés.
    logServerError("password-reset", error, "envoi refusé");
  }
}
