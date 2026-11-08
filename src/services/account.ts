import type { User } from "firebase/auth";
import content from "@country";
import { FREE_ENTITLEMENTS, type Entitlements } from "@/engine/entitlements";
import type { EditionId } from "@/engine/types";
import { AppError, type AppErrorCode } from "./app-error";
import { getFirebaseClient, isFirebaseConfigured } from "./firebase/client";

/**
 * Compte du joueur et droits d'accès, côté navigateur. Le compte n'est demandé qu'au moment d'acheter :
 * le jeu gratuit et la progression locale fonctionnent sans lui, et la connexion ne touche pas à la progression.
 */
export interface Account {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** Compte Google, ou adresse électronique vérifiée : seul un compte permanent peut acheter. */
  verified: boolean;
  method: "google" | "email";
}

/** Disponible sur le web, désactivé dans l'export Android (aucun paiement Mollie dans l'application). */
export const paymentsEnabled = (): boolean => process.env.NEXT_PUBLIC_PAYMENTS !== "off" && isFirebaseConfigured();

function toAccount(user: User): Account {
  const google = user.providerData.some((info) => info.providerId === "google.com");
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    verified: google || user.emailVerified,
    method: google ? "google" : "email",
  };
}

async function client() {
  const firebase = await getFirebaseClient().catch((cause: unknown) => {
    throw new AppError("network", { cause });
  });
  if (!firebase) throw new AppError("accountUnavailable");
  return firebase;
}

/** Codes Firebase traduits en erreurs présentables. */
function accountError(cause: unknown): AppError {
  if (cause instanceof AppError) return cause;
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String((cause as { code: unknown }).code) : "";
  if (code === "auth/network-request-failed") return new AppError("network", { cause });
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-email") {
    return new AppError("signInFailed", { cause });
  }
  if (code === "auth/email-already-in-use") return new AppError("emailInUse", { cause });
  if (code === "auth/weak-password") return new AppError("weakPassword", { cause });
  if (code === "auth/too-many-requests") return new AppError("tooManyAttempts", { cause });
  return new AppError("unknown", { cause });
}

/** `null` quand la fenêtre Google a été fermée par le joueur : rien à signaler. */
export async function signInWithGoogle(): Promise<Account | null> {
  const { auth } = await client();
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  try {
    return toAccount((await signInWithPopup(auth, new GoogleAuthProvider())).user);
  } catch (cause) {
    const code = typeof cause === "object" && cause !== null && "code" in cause ? (cause as { code: unknown }).code : "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
    throw accountError(cause);
  }
}

export async function signInWithEmail(email: string, password: string): Promise<Account> {
  const { auth } = await client();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  try {
    return toAccount((await signInWithEmailAndPassword(auth, email, password)).user);
  } catch (cause) {
    throw accountError(cause);
  }
}

/**
 * Crée le compte et envoie le lien de vérification : l'achat reste bloqué tant que l'adresse n'est pas confirmée.
 * Le courriel part du serveur, avec le modèle de JavaChrist-Mail-Kit. Si l'envoi échoue, le compte existe
 * quand même et l'erreur est levée : l'interface ne doit alors jamais dire que le lien est parti.
 */
export async function signUpWithEmail(email: string, password: string): Promise<Account> {
  const { auth } = await client();
  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  let user: User;
  try {
    ({ user } = await createUserWithEmailAndPassword(auth, email, password));
  } catch (cause) {
    throw accountError(cause);
  }
  await resendVerification();
  return toAccount(user);
}

/** Se résout seulement si le serveur a accepté l'envoi ; sinon, une erreur `verificationNotSent` (ou réseau, session, limite). */
export async function resendVerification(): Promise<void> {
  await callApi<{ sent: boolean }>("/api/account/verification", {}, VERIFICATION_API_ERRORS);
}

/** Relit le compte, par exemple après un clic sur le lien de vérification reçu par courriel. */
export async function reloadAccount(): Promise<Account | null> {
  const { auth } = await client();
  if (!auth.currentUser) return null;
  try {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    return toAccount(auth.currentUser);
  } catch (cause) {
    throw accountError(cause);
  }
}

/** Même réponse du serveur que l'adresse existe ou non, pour ne rien révéler des comptes. */
export async function sendPasswordReset(email: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/account/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
  } catch (cause) {
    throw new AppError("network", { cause });
  }
  if (response.ok) return;
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  throw new AppError(ACCOUNT_API_ERRORS[data.error ?? ""] ?? "unknown");
}

export async function signOutAccount(): Promise<void> {
  const { auth } = await client();
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}

/** Suit le compte connecté. Sans Firebase configuré, le joueur reste anonyme. */
export function watchAccount(listener: (account: Account | null) => void): () => void {
  let unsubscribe: (() => void) | null = null;
  let stopped = false;
  getFirebaseClient()
    .then(async (firebase) => {
      if (!firebase || stopped) return listener(null);
      const { onAuthStateChanged } = await import("firebase/auth");
      if (stopped) return;
      unsubscribe = onAuthStateChanged(firebase.auth, (user) => listener(user ? toAccount(user) : null));
    })
    .catch(() => listener(null));
  return () => {
    stopped = true;
    unsubscribe?.();
  };
}

function parseEntitlements(data: Record<string, unknown> | undefined): Entitlements {
  if (!data) return FREE_ENTITLEMENTS;
  return {
    fullGameAccess: data.fullGameAccess === true,
    familyAccess: data.familyAccess === true,
    adsRemoved: data.adsRemoved === true,
    editions: Array.isArray(data.editions) ? data.editions.filter((id): id is EditionId => typeof id === "string") : [],
  };
}

/**
 * Suit les droits écrits par le serveur. Hors ligne ou en cas d'erreur, `null` : l'interface retombe alors sur l'accès gratuit
 * et le signale, sans jamais lire de droits dans le stockage local.
 */
export function watchEntitlements(uid: string, listener: (entitlements: Entitlements | null) => void): () => void {
  let unsubscribe: (() => void) | null = null;
  let stopped = false;
  getFirebaseClient()
    .then(async (firebase) => {
      if (!firebase || stopped) return listener(null);
      const { doc, onSnapshot } = await import("firebase/firestore");
      if (stopped) return;
      const ref = doc(firebase.db, "entitlements", content.country.legal.kitAppId, "users", uid);
      unsubscribe = onSnapshot(
        ref,
        (snapshot) => listener(snapshot.metadata.fromCache && !snapshot.exists() ? null : parseEntitlements(snapshot.data())),
        () => listener(null),
      );
    })
    .catch(() => listener(null));
  return () => {
    stopped = true;
    unsubscribe?.();
  };
}

// --- Appels au serveur ------------------------------------------------------------------------------------------

/** Codes renvoyés par les routes de paiement, traduits en erreurs présentables. */
const API_ERRORS: Record<string, AppErrorCode> = {
  unauthenticated: "sessionExpired",
  unverifiedAccount: "unverifiedAccount",
  consentMissing: "consentMissing",
  upgradeUndefined: "alreadyOwned",
  otherInProgress: "paymentInProgress",
  notFound: "orderNotFound",
  unavailable: "paymentsUnavailable",
  tooManyAttempts: "tooManyAttempts",
};

/** Routes de compte : un service indisponible concerne le compte, pas les paiements. */
const ACCOUNT_API_ERRORS: Record<string, AppErrorCode> = { ...API_ERRORS, unavailable: "accountUnavailable", invalidRequest: "signInFailed" };

/** Lien de vérification : un échec du serveur veut dire « lien non envoyé », le compte, lui, existe. */
const VERIFICATION_API_ERRORS: Record<string, AppErrorCode> = { ...ACCOUNT_API_ERRORS, unavailable: "verificationNotSent", unknown: "verificationNotSent" };

async function callApi<T>(path: string, body: unknown, errors: Record<string, AppErrorCode> = API_ERRORS): Promise<T> {
  const { auth } = await client();
  if (!auth.currentUser) throw new AppError("sessionExpired");
  const token = await auth.currentUser.getIdToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (cause) {
    throw new AppError("network", { cause });
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new AppError(errors[data.error ?? ""] ?? errors.unknown ?? (errors === API_ERRORS ? "paymentFailed" : "unknown"));
  return data;
}

export interface CheckoutConsent {
  termsAccepted: boolean;
  immediateAccessRequested: boolean;
  withdrawalWaiverAccepted: boolean;
}

export type CheckoutResponse = { checkoutUrl: string; orderId: string } | { alreadyPaid: true; orderId: string };

export const requestCheckout = (editionId: EditionId, consent: CheckoutConsent) =>
  callApi<CheckoutResponse>("/api/payments/checkout", { editionId, consent });

export interface OrderState {
  id: string;
  editionId: EditionId;
  status: string;
}

export const requestOrderSync = (orderId: string) => callApi<OrderState>("/api/payments/sync", { orderId });

export const requestRestore = () => callApi<Entitlements>("/api/entitlements/restore", {});
