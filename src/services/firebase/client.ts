import { Capacitor } from "@capacitor/core";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

/**
 * Firebase côté navigateur, chargé à la demande : le jeu gratuit ne télécharge rien tant qu'aucun compte n'est utilisé.
 * Seules les clés publiques `NEXT_PUBLIC_FIREBASE_*` sont lues ici. La clé d'administration reste sur le serveur.
 */
export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Sans configuration, comptes et achats sont indisponibles et le jeu reste gratuit. */
export const isFirebaseConfigured = (): boolean => Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

let pending: Promise<FirebaseClient | null> | null = null;

export function getFirebaseClient(): Promise<FirebaseClient | null> {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return Promise.resolve(null);
  pending ??= (async () => {
    const [{ initializeApp, getApps }, authModule, firestoreModule] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
    const app = getApps()[0] ?? initializeApp(config);
    // Application Android : session persistée dans IndexedDB de la WebView, sans le résolveur de fenêtres
    // surgissantes (la connexion Google passe par le gestionnaire d'identifiants d'Android).
    const auth = Capacitor.isNativePlatform()
      ? authModule.initializeAuth(app, {
          persistence: [authModule.indexedDBLocalPersistence, authModule.browserLocalPersistence],
        })
      : authModule.getAuth(app);
    // Persistance locale : la session survit au rechargement. Firestore garde un cache mémoire uniquement,
    // pour que des droits périmés ne puissent jamais être relus hors ligne.
    const db = firestoreModule.getFirestore(app);
    if (useEmulators) {
      authModule.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      firestoreModule.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
    return { app, auth, db };
  })().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}
