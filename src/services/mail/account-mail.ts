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
 * Le courriel pointe vers notre page `/connexion/lien`, pas vers la page générique de Firebase.
 * Seuls le mode et le code à usage unique du lien Firebase sont repris.
 */
function appActionLink(firebaseLink: string): string {
  const source = new URL(firebaseLink);
  const mode = source.searchParams.get("mode");
  const oobCode = source.searchParams.get("oobCode");
  if (!mode || !oobCode) throw new Error("Lien d'action Firebase incomplet");
  const target = new URL("/connexion/lien", appBaseUrl());
  target.searchParams.set("mode", mode);
  target.searchParams.set("oobCode", oobCode);
  return target.toString();
}

type Throttle = { lastAt: number; windowStart: number; count: number; expireAt: Timestamp };

/** Envoi accepté par la limite. `release` rend la tentative si le serveur n'a pas pu envoyer. */
export interface SendSlot {
  release: () => Promise<void>;
}

/**
 * Limite d'envoi par adresse : par défaut un courriel par minute, cinq par heure. La clé est une empreinte :
 * aucune adresse en clair n'est stockée. `mailThrottle` n'est lisible ni modifiable depuis le navigateur.
 * `null` si la limite est atteinte.
 */
export async function allowSend(
  kind: string,
  address: string,
  { minIntervalMs = MIN_INTERVAL_MS, maxPerWindow = MAX_PER_WINDOW } = {},
): Promise<SendSlot | null> {
  const key = createHash("sha256").update(`${APP_ID}:${kind}:${address.trim().toLowerCase()}`).digest("hex");
  const ref = adminDb().collection("mailThrottle").doc(key);
  const previous = await adminDb().runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data() as Throttle | undefined;
    const now = Date.now();
    if (data && now - data.lastAt < minIntervalMs) return null;
    const sameWindow = data && now - data.windowStart < WINDOW_MS;
    if (sameWindow && data.count >= maxPerWindow) return null;
    transaction.set(ref, {
      lastAt: now,
      windowStart: sameWindow ? data.windowStart : now,
      count: sameWindow ? data.count + 1 : 1,
      // Pour une règle de durée de vie Firestore éventuelle : rien n'est utile au-delà d'une journée.
      expireAt: Timestamp.fromMillis(now + 24 * 60 * 60_000),
    });
    return { data, now };
  });
  if (!previous) return null;
  return {
    // Remet le compteur dans l'état d'avant, sauf si une autre tentative l'a modifié entre-temps.
    release: () =>
      adminDb().runTransaction(async (transaction) => {
        const current = (await transaction.get(ref)).data() as Throttle | undefined;
        if (current?.lastAt !== previous.now) return;
        if (previous.data) transaction.set(ref, previous.data);
        else transaction.delete(ref);
      }),
  };
}

/** Rend la tentative sans masquer l'erreur d'origine. */
export async function releaseQuietly(slot: SendSlot): Promise<void> {
  await slot.release().catch((error: unknown) => logServerError("mail-throttle", error, "tentative non rendue"));
}

/**
 * Lien de vérification de l'adresse du compte connecté. Rien n'est envoyé si l'adresse est déjà vérifiée.
 * Un échec du serveur (lien ou envoi) rend la tentative : seuls les envois réussis comptent dans la limite.
 */
export async function sendVerificationMail(buyer: Buyer): Promise<{ sent: boolean }> {
  const user = await adminAuth().getUser(buyer.uid);
  if (!user.email || user.emailVerified) return { sent: false };
  const slot = await allowSend("verify", user.email);
  if (!slot) throw new PaymentRequestError(429, "tooManyAttempts");
  try {
    const link = appActionLink(await adminAuth().generateEmailVerificationLink(user.email, actionSettings()));
    await sendTemplateMail("confirmation", user.email, { ConfirmationURL: link, SiteURL: appBaseUrl() });
  } catch (error) {
    await releaseQuietly(slot);
    throw error;
  }
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
  const slot = await allowSend("reset", email);
  if (!slot) throw new PaymentRequestError(429, "tooManyAttempts");
  let link: string;
  try {
    link = appActionLink(await auth.generatePasswordResetLink(email, actionSettings()));
  } catch (error) {
    const code = firebaseErrorCode(error);
    // Adresse inconnue : la tentative compte, comme pour un compte existant, sinon la limite trahirait le compte.
    if (code === "auth/user-not-found" || code === "auth/email-not-found") return;
    // Échec du serveur, identique quelle que soit l'adresse : tentative rendue, 503 sans détail.
    await releaseQuietly(slot);
    throw new ServiceUnavailableError("firebase-auth", code);
  }
  try {
    await sendTemplateMail("reset-password", email, { ConfirmationURL: link, SiteURL: appBaseUrl() });
  } catch (error) {
    // Ni l'adresse ni le lien ne sont journalisés. La tentative n'est pas rendue : une limite différente
    // d'une adresse inconnue révélerait que le compte existe.
    logServerError("password-reset", error, "envoi refusé");
  }
}
