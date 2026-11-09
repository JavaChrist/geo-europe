import content from "@country";
import { FieldValue } from "firebase-admin/firestore";
import {
  canAddGrant,
  canRevokeGrant,
  normalizeEmail,
  type GrantRecord,
  type GrantStatus,
} from "@/engine/grants";
import {
  adminAuth,
  adminDb,
  firebaseErrorCode,
  ServiceUnavailableError,
} from "@/services/firebase/admin";
import {
  grantsCollection,
  PaymentRequestError,
  recomputeEntitlements,
  verifyBuyer,
} from "@/services/payments/orders";

/**
 * Accès offerts, côté serveur uniquement (voir `docs/acces-offerts.md`).
 *
 * - `grants/{appId}/emails/{adresse normalisée}` : un document par adresse, donc aucun doublon possible.
 *   L'accès ne vaut que pour l'application qui le porte : GéoFR n'ouvre pas GéoDE.
 * - `admins/{uid}` : administrateurs, avec la liste `apps` des applications qu'ils gèrent. Créé et retiré
 *   uniquement par `scripts/admin.mjs`, avec le compte de service : aucune route ne permet de s'y inscrire.
 *
 * Les règles Firestore refusent ces deux collections au navigateur, en lecture comme en écriture.
 */
const APP_ID = content.country.legal.kitAppId;
const MAX_LISTED = 500;

export interface Admin {
  uid: string;
}

/** Administrateur de cette application : compte permanent, et document `admins/{uid}` qui la cite. Sinon 403. */
export async function verifyAdmin(request: Request): Promise<Admin> {
  const buyer = await verifyBuyer(request, { requireVerified: false });
  if (!buyer.verified) throw new PaymentRequestError(403, "forbidden");
  const snapshot = await adminDb().collection("admins").doc(buyer.uid).get();
  const apps: unknown = snapshot.exists ? snapshot.data()?.apps : null;
  if (!Array.isArray(apps) || !apps.includes(APP_ID))
    throw new PaymentRequestError(403, "forbidden");
  return { uid: buyer.uid };
}

const iso = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

function toRecord(id: string, data: Record<string, unknown>): GrantRecord {
  return {
    email: id,
    status: (data.status as GrantStatus | undefined) ?? "pending",
    uid: typeof data.uid === "string" ? data.uid : null,
    addedAt: iso(data.addedAt) ?? "",
    addedBy: typeof data.addedBy === "string" ? data.addedBy : "",
    revokedAt: iso(data.revokedAt),
    revokedBy: typeof data.revokedBy === "string" ? data.revokedBy : null,
    activatedAt: iso(data.activatedAt),
  };
}

const historyEntry = (event: string, by: string) => ({
  event,
  by,
  at: new Date().toISOString(),
});

function requireEmail(input: unknown): string {
  const email = normalizeEmail(input);
  if (!email) throw new PaymentRequestError(400, "invalidEmail");
  return email;
}

export async function listGrants(): Promise<GrantRecord[]> {
  const snapshot = await grantsCollection(adminDb())
    .orderBy("addedAt", "desc")
    .limit(MAX_LISTED)
    .get();
  return snapshot.docs.map((doc) => toRecord(doc.id, doc.data()));
}

/**
 * Compte déjà inscrit avec cette adresse, s'il est permanent (adresse confirmée, ou Google).
 * Sinon `null` : l'accès reste en attente et sera rattaché à la première connexion avec l'adresse confirmée.
 */
async function permanentAccountOf(email: string): Promise<string | null> {
  try {
    const user = await adminAuth().getUserByEmail(email);
    const google = user.providerData.some(
      (provider) => provider.providerId === "google.com",
    );
    if (normalizeEmail(user.email) !== email || !(user.emailVerified || google))
      return null;
    return user.uid;
  } catch (error) {
    const code = firebaseErrorCode(error);
    if (code === "auth/user-not-found") return null;
    throw new ServiceUnavailableError("firebase-auth", code);
  }
}

/** Ajoute une adresse, ou réactive une adresse révoquée. Un compte déjà inscrit et confirmé reçoit l'accès aussitôt. */
export async function addGrant(
  admin: Admin,
  input: unknown,
): Promise<GrantRecord> {
  const email = requireEmail(input);
  const db = adminDb();
  const ref = grantsCollection(db).doc(email);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    const status = existing.exists
      ? ((existing.data()?.status as GrantStatus | undefined) ?? null)
      : null;
    if (!canAddGrant(status))
      throw new PaymentRequestError(409, "alreadyGranted");
    transaction.set(
      ref,
      {
        app: APP_ID,
        email,
        status: "pending",
        uid: null,
        addedAt: new Date().toISOString(),
        addedBy: admin.uid,
        revokedAt: null,
        revokedBy: null,
        activatedAt: null,
        history: FieldValue.arrayUnion(historyEntry("added", admin.uid)),
      },
      { merge: true },
    );
  });

  const uid = await permanentAccountOf(email);
  if (uid) {
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      if (current.data()?.status !== "pending") return;
      transaction.update(ref, {
        status: "active",
        uid,
        activatedAt: new Date().toISOString(),
        history: FieldValue.arrayUnion(historyEntry("activated", admin.uid)),
      });
    });
    await recomputeEntitlements(uid);
  }
  const saved = await ref.get();
  return toRecord(saved.id, saved.data() ?? {});
}

/** Révoque un accès. Les droits du compte rattaché sont recalculés aussitôt : ses achats réels restent. */
export async function revokeGrant(
  admin: Admin,
  input: unknown,
): Promise<GrantRecord> {
  const email = requireEmail(input);
  const db = adminDb();
  const ref = grantsCollection(db).doc(email);
  const uid = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    const status = existing.exists
      ? ((existing.data()?.status as GrantStatus | undefined) ?? null)
      : null;
    if (!canRevokeGrant(status))
      throw new PaymentRequestError(404, "notGranted");
    transaction.update(ref, {
      status: "revoked",
      revokedAt: new Date().toISOString(),
      revokedBy: admin.uid,
      history: FieldValue.arrayUnion(historyEntry("revoked", admin.uid)),
    });
    const linked: unknown = existing.data()?.uid;
    return typeof linked === "string" ? linked : null;
  });
  if (uid) await recomputeEntitlements(uid);
  const saved = await ref.get();
  return toRecord(saved.id, saved.data() ?? {});
}
