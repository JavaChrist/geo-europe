/**
 * Accès offerts : des adresses électroniques choisies par l'administrateur reçoivent gratuitement tout le jeu,
 * sans commande ni paiement. Logique pure, sans Firebase : le serveur l'applique (voir `docs/acces-offerts.md`).
 *
 * Une liste par application (`grants/{appId}/emails/{adresse}`) : un accès à GéoFR n'ouvre pas GéoDE.
 */

/**
 * - `pending` : adresse ajoutée, aucun compte confirmé ne l'utilise encore ;
 * - `active` : rattachée à un compte dont l'adresse est confirmée ;
 * - `revoked` : retirée par l'administrateur. Le document reste, pour l'historique.
 */
export type GrantStatus = "pending" | "active" | "revoked";

export interface GrantRecord {
  email: string;
  status: GrantStatus;
  /** Compte rattaché, une fois l'adresse confirmée. */
  uid: string | null;
  addedAt: string;
  addedBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
  activatedAt: string | null;
}

const MAX_EMAIL_LENGTH = 254;

/**
 * Forme unique d'une adresse : espaces retirés, minuscules, Unicode normalisé. Rien d'autre n'est réécrit
 * (ni points ni « +étiquette » chez Gmail) : seule l'adresse exacte confirmée par le joueur donne l'accès.
 * `null` si l'adresse n'est pas utilisable. Le `/` est refusé : l'adresse sert d'identifiant de document.
 */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().normalize("NFC").toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null;
  if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/.]+$/.test(email)) return null;
  if (email.startsWith(".") || email.includes("..")) return null;
  return email;
}

/** Un accès est valable tant qu'il n'est pas révoqué, et seulement pour une adresse confirmée. */
export function grantApplies(
  status: GrantStatus | null,
  emailVerified: boolean,
): boolean {
  return emailVerified && (status === "pending" || status === "active");
}

/** Ajout d'une adresse : refusé si elle est déjà en attente ou active. Une adresse révoquée peut être réactivée. */
export function canAddGrant(existing: GrantStatus | null): boolean {
  return existing === null || existing === "revoked";
}

/** Révocation : seulement d'un accès encore valable. */
export function canRevokeGrant(existing: GrantStatus | null): boolean {
  return existing === "pending" || existing === "active";
}
