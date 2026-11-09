import { createHash, createPublicKey, createSign, verify, type JsonWebKey } from "node:crypto";
import content from "@country";
import type { PlayProductPurchase } from "@/engine/google-play";
import { ServerConfigError, ServiceUnavailableError } from "@/services/firebase/admin";

/**
 * API Google Play Developer (v3), en REST, côté serveur uniquement. Aucune dépendance : le jeton OAuth du compte
 * de service est signé avec `node:crypto`. Identifiants dans les variables du serveur, jamais dans l'application :
 *
 * - `GOOGLE_PLAY_CLIENT_EMAIL`, `GOOGLE_PLAY_PRIVATE_KEY` : compte de service invité dans la Play Console
 *   (droits « Afficher les données financières » et « Gérer les commandes »).
 * - `GOOGLE_PLAY_RTDN_AUDIENCE`, `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT` : audience et compte de l'abonnement Pub/Sub
 *   en mode push qui transmet les notifications développeur en temps réel.
 *
 * Voir docs/paiements.md, section Google Play.
 */
export const PLAY_PACKAGE = content.country.androidPackage;

const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PLAY_PACKAGE)}`;

/** Empreinte stable et non réversible : identifiant de compte transmis à Google Play, clé des jetons d'achat. */
export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const base64url = (input: Buffer | string): string => Buffer.from(input).toString("base64url");

// --- Jeton d'accès du compte de service -----------------------------------------------------------------------

let cached: { token: string; expiresAt: number } | null = null;

function credentials(): { email: string; key: string } {
  const email = process.env.GOOGLE_PLAY_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PLAY_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email) throw new ServerConfigError("GOOGLE_PLAY_CLIENT_EMAIL");
  if (!key) throw new ServerConfigError("GOOGLE_PLAY_PRIVATE_KEY");
  return { email, key };
}

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const { email, key } = credentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  let signature: string;
  try {
    signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key, "base64url");
  } catch {
    throw new ServerConfigError("GOOGLE_PLAY_PRIVATE_KEY illisible");
  }
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${header}.${claims}.${signature}`,
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new ServiceUnavailableError("google-oauth", error instanceof Error ? error.name : "network");
  }
  if (!response.ok) throw new ServiceUnavailableError("google-oauth", String(response.status));
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new ServiceUnavailableError("google-oauth", "no-token");
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch (error) {
    throw new ServiceUnavailableError("google-play", error instanceof Error ? error.name : "network");
  }
}

// --- Achats ---------------------------------------------------------------------------------------------------

/** Relevé officiel d'un achat. `null` quand Google ne connaît pas ce jeton pour ce produit. */
export async function fetchPlayPurchase(productId: string, purchaseToken: string): Promise<PlayProductPurchase | null> {
  const response = await call(
    `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`,
  );
  if (response.status === 404 || response.status === 410 || response.status === 400) return null;
  if (!response.ok) throw new ServiceUnavailableError("google-play", String(response.status));
  return (await response.json()) as PlayProductPurchase;
}

/** Accuse réception d'un achat payé. Déjà accusé : Google répond quand même sans erreur, ou 400 que l'on tolère. */
export async function acknowledgePlayPurchase(productId: string, purchaseToken: string): Promise<void> {
  const response = await call(
    `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    { method: "POST", body: "{}" },
  );
  if (!response.ok) throw new ServiceUnavailableError("google-play-acknowledge", String(response.status));
}

export interface VoidedPurchase {
  purchaseToken: string;
  orderId?: string;
  /** 0 autre, 1 remord, 2 non reçu, 3 défectueux, 4 achat accidentel, 5 fraude, 6 ami ou famille, 7 rétrofacturation. */
  voidedReason?: number;
  voidedTimeMillis?: string;
}

/** Achats annulés, remboursés ou contestés des 30 derniers jours (fenêtre par défaut de l'API). */
export async function listVoidedPurchases(): Promise<VoidedPurchase[]> {
  const voided: VoidedPurchase[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ maxResults: "1000", ...(pageToken && { token: pageToken }) });
    const response = await call(`/purchases/voidedpurchases?${query}`);
    if (!response.ok) throw new ServiceUnavailableError("google-play-voided", String(response.status));
    const data = (await response.json()) as {
      voidedPurchases?: VoidedPurchase[];
      tokenPagination?: { nextPageToken?: string };
    };
    voided.push(...(data.voidedPurchases ?? []));
    pageToken = data.tokenPagination?.nextPageToken;
    if (!pageToken) break;
  }
  return voided;
}

// --- Notifications développeur en temps réel (Pub/Sub en mode push) ------------------------------------------

let certs: { keys: Map<string, JsonWebKey>; expiresAt: number } | null = null;

async function googleKeys(): Promise<Map<string, JsonWebKey>> {
  if (certs && certs.expiresAt > Date.now()) return certs.keys;
  let response: Response;
  try {
    response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { cache: "no-store" });
  } catch (error) {
    throw new ServiceUnavailableError("google-certs", error instanceof Error ? error.name : "network");
  }
  if (!response.ok) throw new ServiceUnavailableError("google-certs", String(response.status));
  const data = (await response.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  const keys = new Map<string, JsonWebKey>();
  for (const key of data.keys ?? []) if (key.kid) keys.set(key.kid, key);
  certs = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return keys;
}

/**
 * Vérifie le jeton OIDC que Pub/Sub joint à chaque notification : signature Google (RS256), émetteur, audience,
 * compte de service de l'abonnement, expiration. Sans configuration, toute notification est refusée.
 */
export async function verifyPubSubRequest(request: Request): Promise<boolean> {
  const audience = process.env.GOOGLE_PLAY_RTDN_AUDIENCE;
  const account = process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT;
  if (!audience) throw new ServerConfigError("GOOGLE_PLAY_RTDN_AUDIENCE");
  if (!account) throw new ServerConfigError("GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT");
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const parts = token?.split(".");
  if (!parts || parts.length !== 3) return false;
  const [rawHeader, rawClaims, rawSignature] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: { iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean };
  try {
    header = JSON.parse(Buffer.from(rawHeader, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(rawClaims, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (header.alg !== "RS256" || !header.kid) return false;
  const jwk = (await googleKeys()).get(header.kid);
  if (!jwk) return false;
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${rawHeader}.${rawClaims}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(rawSignature, "base64url"),
  );
  if (!valid) return false;
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return false;
  if (claims.aud !== audience) return false;
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return false;
  return claims.email === account && claims.email_verified === true;
}

/** Contenu utile d'une notification Google Play (`message.data`, JSON encodé en base64). */
export interface PlayNotification {
  packageName?: string;
  oneTimeProductNotification?: { notificationType?: number; purchaseToken?: string; sku?: string };
  voidedPurchaseNotification?: { purchaseToken?: string; orderId?: string; productType?: number; refundType?: number };
  testNotification?: unknown;
}

export function decodePlayNotification(body: Record<string, unknown>): PlayNotification | null {
  const message = body.message as { data?: unknown } | undefined;
  if (typeof message?.data !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(message.data, "base64").toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as PlayNotification) : null;
  } catch {
    return null;
  }
}
