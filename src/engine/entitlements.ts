import type { Edition, EditionId, EditionsConfig } from "./types.ts";

/**
 * Droits d'accès d'un joueur, toujours recalculés à partir de ses commandes vérifiées par le serveur.
 * Aucun droit ne vient du navigateur : ni stockage local, ni paramètre d'adresse, ni réponse du client.
 */
export interface Entitlements {
  /** Toutes les régions, tous les niveaux et tous les défis Solo. */
  fullGameAccess: boolean;
  /** Mode Famille, de 2 à 4 joueurs. */
  familyAccess: boolean;
  /** Aucune publicité ni promotion JavaChrist. */
  adsRemoved: boolean;
  /** Éditions payées et toujours valables. Un accès offert n'y ajoute rien : ce n'est pas un achat. */
  editions: EditionId[];
  /** Accès offert par l'administrateur (voir `docs/acces-offerts.md`) : droits de l'édition Famille sans publicités. */
  granted: boolean;
}

export const FREE_ENTITLEMENTS: Entitlements = { fullGameAccess: false, familyAccess: false, adsRemoved: false, editions: [], granted: false };

/**
 * État d'une commande. Les états Mollie sont repris tels quels, plus :
 * `created` (commande enregistrée, paiement pas encore créé), `refunded` (remboursée en totalité),
 * `charged_back` (contestée par la banque) et `error` (le paiement n'a pas pu être créé).
 */
export type OrderStatus =
  | "created"
  | "open"
  | "pending"
  | "authorized"
  | "paid"
  | "canceled"
  | "expired"
  | "failed"
  | "refunded"
  | "charged_back"
  | "error";

/** Seule une commande payée, ni remboursée ni contestée, donne des droits. */
export const grantsRights = (status: OrderStatus): boolean => status === "paid";

/** Le paiement peut encore aboutir : on ne crée pas de seconde commande pendant ce temps. */
export const isInProgress = (status: OrderStatus): boolean =>
  status === "created" || status === "open" || status === "pending" || status === "authorized";

export interface OrderRights {
  editionId: EditionId;
  status: OrderStatus;
}

function rightsOf(edition: Edition): Entitlements {
  const paid = edition.purchase === "one_time";
  return {
    fullGameAccess: paid && edition.regions === "all",
    familyAccess: paid && edition.mode === "family",
    adsRemoved: paid && edition.ads === false,
    editions: paid ? [edition.id] : [],
    granted: false,
  };
}

/** Union des droits de toutes les commandes encore valables. Un remboursement ne retire que les droits de sa commande. */
export function computeEntitlements(orders: OrderRights[], config: EditionsConfig): Entitlements {
  return orders
    .filter((order) => grantsRights(order.status))
    .map((order) => config.editions.find((edition) => edition.id === order.editionId))
    .filter((edition): edition is Edition => edition !== undefined)
    .map(rightsOf)
    .reduce<Entitlements>(
      (total, rights) => ({
        fullGameAccess: total.fullGameAccess || rights.fullGameAccess,
        familyAccess: total.familyAccess || rights.familyAccess,
        adsRemoved: total.adsRemoved || rights.adsRemoved,
        editions: [...new Set([...total.editions, ...rights.editions])],
        granted: total.granted || rights.granted,
      }),
      FREE_ENTITLEMENTS,
    );
}

/**
 * Droits effectifs : ceux des achats, complétés par un accès offert. L'accès offert ouvre tout (régions, niveaux, défis,
 * Mode Famille, sans publicités) mais n'ajoute aucune édition : les achats restent visibles tels quels, et une révocation
 * ne retire que ce que l'accès offert apportait.
 */
export function effectiveEntitlements(purchased: Entitlements, granted: boolean): Entitlements {
  if (!granted) return { ...purchased, granted: false };
  return { fullGameAccess: true, familyAccess: true, adsRemoved: true, editions: purchased.editions, granted: true };
}

/** Régions jouables sans achat, celles de l'édition gratuite. */
export function freeRegionIds(config: EditionsConfig): string[] {
  const free = config.editions.find((edition) => edition.purchase === "free");
  return free && free.regions !== "all" ? free.regions : [];
}

export function canPlayRegion(entitlements: Entitlements, regionId: string, config: EditionsConfig): boolean {
  return entitlements.fullGameAccess || freeRegionIds(config).includes(regionId);
}

export type PurchaseRefusal =
  /** L'édition n'existe pas ou n'est pas payante. */
  | "notForSale"
  /** Le joueur possède déjà une édition : les tarifs d'évolution ne sont pas encore définis. */
  | "upgradeUndefined"
  /** Un autre paiement est en cours pour une autre édition. */
  | "otherInProgress"
  /** Le joueur bénéficie d'un accès offert : il a déjà tout, aucun achat ne lui est proposé. */
  | "offeredAccess";

export type PurchaseCheck =
  | { allowed: true; resumeOrderIndex: number | null }
  | { allowed: false; reason: PurchaseRefusal };

/**
 * Un seul achat par compte tant que les tarifs d'évolution ne sont pas validés : ni doublon, ni changement
 * d'édition qui ferait perdre des droits ou payer deux fois. Un paiement en cours pour la même édition est repris.
 */
export function purchaseCheck(target: EditionId, orders: OrderRights[], config: EditionsConfig, granted = false): PurchaseCheck {
  const edition = config.editions.find((candidate) => candidate.id === target);
  if (!edition || edition.purchase !== "one_time") return { allowed: false, reason: "notForSale" };
  if (granted) return { allowed: false, reason: "offeredAccess" };
  if (orders.some((order) => grantsRights(order.status))) return { allowed: false, reason: "upgradeUndefined" };
  const inProgress = orders.findIndex((order) => isInProgress(order.status));
  if (inProgress === -1) return { allowed: true, resumeOrderIndex: null };
  if (orders[inProgress]?.editionId !== target) return { allowed: false, reason: "otherInProgress" };
  return { allowed: true, resumeOrderIndex: inProgress };
}

/** Identifiant produit d'une édition chez les fournisseurs de paiement : `geofr_solo_ads`. */
export const productIdOf = (appId: string, editionId: EditionId): string => `${appId}_${editionId}`;
