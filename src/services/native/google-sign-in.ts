import { Capacitor, registerPlugin } from "@capacitor/core";
import { AppError } from "../app-error";

/**
 * Connexion Google dans l'application Android, par le plugin local `GoogleSignIn`
 * (android/app/src/main/java/.../GoogleSignInPlugin.java, gestionnaire d'identifiants d'Android).
 * Le plugin ne rend qu'un jeton d'identité Google ; la session est ouverte par le SDK Firebase web.
 * L'identifiant client OAuth « Web » du projet Firebase est public (`NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`).
 */
interface GoogleSignInPlugin {
  signIn(options: { webClientId: string }): Promise<{ idToken: string | null; canceled: boolean }>;
  signOut(): Promise<void>;
}

const GoogleSignIn = registerPlugin<GoogleSignInPlugin>("GoogleSignIn");

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** `null` quand le joueur ferme le sélecteur de compte. */
export async function nativeGoogleIdToken(): Promise<string | null> {
  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new AppError("accountUnavailable");
  let result: { idToken: string | null; canceled: boolean };
  try {
    result = await GoogleSignIn.signIn({ webClientId });
  } catch (cause) {
    throw new AppError("signInFailed", { cause });
  }
  return result.canceled ? null : result.idToken;
}

/** Oublie le compte Google choisi, pour que la prochaine connexion propose à nouveau le choix. */
export async function nativeGoogleSignOut(): Promise<void> {
  if (!isNativeApp()) return;
  await GoogleSignIn.signOut().catch(() => undefined);
}
