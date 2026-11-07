import type { Edition, EditionId, EditionsConfig } from "./types.ts";

/** Toutes les éditions de la collection, dans l'ordre d'affichage. Chaque pays les décrit toutes. */
export const EDITION_IDS = ["discovery", "solo_ads", "solo_no_ads", "family_ads", "family_no_ads"] as const satisfies readonly EditionId[];

export function findEdition(config: EditionsConfig, id: EditionId): Edition {
  const edition = config.editions.find((candidate) => candidate.id === id);
  if (!edition) throw new Error(`Édition absente de la configuration : ${id}`);
  return edition;
}

/** Les éditions payantes, seules transmises au catalogue du Legal Kit. La Découverte gratuite relève des CGU. */
export function paidEditions(config: EditionsConfig): Edition[] {
  return config.editions.filter((edition) => edition.purchase === "one_time");
}

/** Erreurs de la grille d'un pays. Liste vide : grille valide. */
export function editionsErrors(config: EditionsConfig): string[] {
  const errors: string[] = [];
  if (!/^[A-Z]{3}$/.test(config.currency)) errors.push(`devise invalide : ${config.currency}`);
  const ids = config.editions.map((edition) => edition.id);
  for (const id of EDITION_IDS) if (!ids.includes(id)) errors.push(`édition absente : ${id}`);
  if (new Set(ids).size !== ids.length) errors.push("édition en double");
  for (const edition of config.editions) {
    if (!(EDITION_IDS as readonly string[]).includes(edition.id)) errors.push(`édition inconnue : ${edition.id}`);
    if (!Number.isSafeInteger(edition.priceCents) || edition.priceCents < 0) errors.push(`${edition.id} : prix en centimes invalide`);
    if (edition.purchase === "free" && edition.priceCents !== 0) errors.push(`${edition.id} : une édition gratuite coûte 0`);
    if (edition.purchase === "one_time" && edition.priceCents === 0) errors.push(`${edition.id} : un achat unique a un prix`);
    if (edition.purchase !== "free" && edition.purchase !== "one_time") errors.push(`${edition.id} : achat unique ou gratuit uniquement`);
    if (edition.purchase === "one_time" && edition.ads === null) errors.push(`${edition.id} : publicité à décider avant toute vente`);
    if (edition.status !== "planned") errors.push(`${edition.id} : aucune édition ne peut être en vente sans validation de Christian`);
  }
  if (config.editions.filter((edition) => edition.purchase === "free").length !== 1) errors.push("une seule édition gratuite attendue");
  return errors;
}

/** Offre au format du catalogue de JavaChrist-Legal-Kit (`catalogs/<id>.json`). */
export interface KitOffer {
  id: string;
  name: string;
  description: string;
  type: "one_time";
  channel: string;
  status: "planned" | "active";
  amountMinor: number;
  taxDisplay: "TTC";
  period: null;
  storeProductId: null;
  priceSource: "catalog";
}

/** Catalogue du kit produit à partir de la grille : aucune copie de prix tapée à la main. */
export function buildKitCatalog(
  config: EditionsConfig,
  text: { name: (id: EditionId) => string; description: (id: EditionId) => string },
): { currency: string; offers: KitOffer[] } {
  return {
    currency: config.currency,
    offers: paidEditions(config).map((edition) => ({
      id: edition.id,
      name: text.name(edition.id),
      description: text.description(edition.id),
      type: "one_time",
      channel: config.channel,
      status: edition.status,
      amountMinor: edition.priceCents,
      taxDisplay: "TTC",
      period: null,
      storeProductId: null,
      priceSource: "catalog",
    })),
  };
}
