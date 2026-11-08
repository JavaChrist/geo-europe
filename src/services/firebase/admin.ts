import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Serveur uniquement : ce module ne doit jamais être importé par un composant client.
if (typeof window !== "undefined") throw new Error("firebase-admin est réservé au serveur");

/**
 * Firebase Admin, serveur uniquement. Les identifiants viennent des variables d'environnement de Vercel,
 * jamais d'un fichier du dépôt. Avec les émulateurs (`FIRESTORE_EMULATOR_HOST`), aucun identifiant n'est nécessaire.
 */
export class ServerConfigError extends Error {
  constructor(missing: string) {
    super(`Configuration serveur incomplète : ${missing}`);
    this.name = "ServerConfigError";
  }
}

/**
 * Service configuré mais injoignable ou refusant les identifiants du serveur (clé révoquée, réseau, quota).
 * Ce n'est jamais la faute du joueur : la route répond 503, pas 401. `code` est le code Firebase, sans détail.
 */
export class ServiceUnavailableError extends Error {
  constructor(
    readonly service: string,
    readonly code: string,
  ) {
    super(`Service indisponible : ${service}${code ? ` (${code})` : ""}`);
    this.name = "ServiceUnavailableError";
  }
}

/** Code d'une erreur Firebase (`auth/id-token-expired`…), ou chaîne vide. */
export function firebaseErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
}

let app: App | null = null;

function adminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) return (app = existing);

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!projectId) throw new ServerConfigError("FIREBASE_ADMIN_PROJECT_ID");
  if (process.env.FIRESTORE_EMULATOR_HOST) return (app = initializeApp({ projectId }));

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Vercel conserve les retours à la ligne de la clé sous la forme « \n ».
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail) throw new ServerConfigError("FIREBASE_ADMIN_CLIENT_EMAIL");
  if (!privateKey) throw new ServerConfigError("FIREBASE_ADMIN_PRIVATE_KEY");
  return (app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }));
}

export const adminAuth = (): Auth => getAuth(adminApp());
export const adminDb = (): Firestore => getFirestore(adminApp());
