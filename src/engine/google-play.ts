import type { EditionsConfig } from "./types.ts";
import { nextOrderStatus, type PaymentMode } from "./payments.ts";
import type { OrderStatus } from "./entitlements.ts";
import type { EditionId } from "./types.ts";

/**
 * Règles Google Play Billing, sans réseau ni Firebase (testées par scripts/check-payments.mjs).
 * Le serveur relit chaque achat avec l'API Google Play Developer (`purchases.products.get`) : seul ce relevé
 * officiel compte, jamais le résultat transmis par l'application. Voir docs/paiements.md, section Google Play.
 */

/** Relevé `purchases.products.get` (API Google Play Developer v3), champs utilisés seulement. */
export interface PlayProductPurchase {
  /** 0 acheté, 1 annulé, 2 en attente. */
  purchaseState: number;
  /** 0 pas encore accusé, 1 accusé. */
  acknowledgementState: number;
  /** 0 test (testeur de licence), 1 code promo, 2 récompense. Absent pour un achat réel. */
  purchaseType?: number;
  orderId?: string;
  obfuscatedExternalAccountId?: string;
  obfuscatedExternalProfileId?: string;
  purchaseTimeMillis?: string;
  regionCode?: string;
}

/** Produit Play d'une édition payante : `geofr_solo_ads` (même règle que `productIdOf`). Aucun produit pour l'édition gratuite. */
export function playProductIds(appId: string, config: EditionsConfig): Record<string, EditionId> {
  const products: Record<string, EditionId> = {};
  for (const edition of config.editions) {
    if (edition.purchase === "one_time") products[`${appId}_${edition.id}`] = edition.id;
  }
  return products;
}

export function editionOfProduct(appId: string, productId: string, config: EditionsConfig): EditionId | null {
  return playProductIds(appId, config)[productId] ?? null;
}

/** Les jetons Play sont opaques ; on se contente de refuser l'absurde avant tout appel réseau. */
export const isPlausiblePurchaseToken = (token: unknown): token is string =>
  typeof token === "string" && token.length >= 20 && token.length <= 4096 && /^[A-Za-z0-9._:-]+$/.test(token);

export function playPurchaseStatus(purchase: PlayProductPurchase): OrderStatus {
  if (purchase.purchaseState === 0) return "paid";
  if (purchase.purchaseState === 2) return "pending";
  return "canceled";
}

/** `test` pour un testeur de licence, `live` pour un achat réel ou un code promo. Les récompenses ne sont pas des achats. */
export function playPurchaseMode(purchase: PlayProductPurchase): PaymentMode | null {
  if (purchase.purchaseType === 0) return "test";
  if (purchase.purchaseType === undefined || purchase.purchaseType === 1) return "live";
  return null;
}

/** Ce que le serveur a enregistré au moment de préparer l'achat. */
export interface PlayOrderReference {
  id: string;
  editionId: EditionId;
  status: OrderStatus;
  /** Empreinte du compte transmise à Google Play (`obfuscatedAccountId`). */
  accountHash: string;
  /** Mode accepté par le serveur : `test` tant que les éditions ne sont pas en vente. */
  mode: PaymentMode;
  /** Jeton déjà rattaché à cette commande, s'il y en a un. */
  purchaseToken: string | null;
}

export type PlayMismatch = "account" | "order" | "product" | "mode" | "token";

export type PlayAssessment =
  | { ok: true; status: OrderStatus; acknowledge: boolean }
  | { ok: false; mismatch: PlayMismatch };

/**
 * Confronte l'achat officiel à la commande préparée. Le moindre écart refuse l'achat : aucun droit,
 * aucun accusé de réception, et Google le rembourse de lui-même au bout de 3 jours.
 * `acknowledge` dit s'il faut accuser réception maintenant (achat payé, rattaché et pas encore accusé).
 */
export function assessPlayPurchase(
  order: PlayOrderReference,
  purchase: PlayProductPurchase,
  input: { productId: string; purchaseToken: string; appId: string; config: EditionsConfig },
): PlayAssessment {
  if (order.purchaseToken !== null && order.purchaseToken !== input.purchaseToken) return { ok: false, mismatch: "token" };
  if (editionOfProduct(input.appId, input.productId, input.config) !== order.editionId) return { ok: false, mismatch: "product" };
  if (purchase.obfuscatedExternalAccountId !== order.accountHash) return { ok: false, mismatch: "account" };
  if (purchase.obfuscatedExternalProfileId !== order.id) return { ok: false, mismatch: "order" };
  if (playPurchaseMode(purchase) !== order.mode) return { ok: false, mismatch: "mode" };
  const status = nextOrderStatus(order.status, playPurchaseStatus(purchase));
  return { ok: true, status, acknowledge: status === "paid" && purchase.acknowledgementState !== 1 };
}

/** `voidedpurchases.list` : raison 7 = rétrofacturation, toute autre = remboursement ou annulation. */
export const voidedStatus = (voidedReason: number | undefined): OrderStatus =>
  voidedReason === 7 ? "charged_back" : "refunded";

/** Notification développeur en temps réel (`oneTimeProductNotification.notificationType`). */
export type PlayNotificationKind = "purchased" | "canceled" | "other";

export function playNotificationKind(notificationType: unknown): PlayNotificationKind {
  // 1 ONE_TIME_PRODUCT_PURCHASED, 2 ONE_TIME_PRODUCT_CANCELED.
  if (notificationType === 1) return "purchased";
  if (notificationType === 2) return "canceled";
  return "other";
}
