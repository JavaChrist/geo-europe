import type { EditionsConfig } from "../../src/engine/types.ts";

/**
 * Grille commerciale de GéoFR, prix TTC. Achats uniques, aucun abonnement.
 * Rien n'est en vente : toutes les éditions restent `planned`, et aucun accès n'en dépend.
 * Le catalogue du Legal Kit est produit à partir de ce fichier par `scripts/export-catalog.mjs`.
 */
export const editions: EditionsConfig = {
  currency: "EUR",
  channel: "web (Mollie) et Google Play",
  editions: [
    { id: "discovery", mode: "discovery", ads: null, priceCents: 0, purchase: "free", regions: 2, status: "planned" },
    { id: "solo_ads", mode: "solo", ads: true, priceCents: 999, purchase: "one_time", regions: "all", status: "planned" },
    { id: "solo_no_ads", mode: "solo", ads: false, priceCents: 1499, purchase: "one_time", regions: "all", status: "planned" },
    { id: "family_ads", mode: "family", ads: true, priceCents: 1499, purchase: "one_time", regions: "all", status: "planned" },
    { id: "family_no_ads", mode: "family", ads: false, priceCents: 1999, purchase: "one_time", regions: "all", status: "planned" },
  ],
};
