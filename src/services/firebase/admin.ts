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
