import type { EditionsConfig } from "../../src/engine/types.ts";

/**
 * Grille commerciale de GéoFR, prix TTC. Achats uniques, aucun abonnement.
 * Vente réelle ouverte sur le web (Mollie, clé `live_`) par validation de Christian : toutes les éditions sont `active`.
 * Google Play reste en mode test (`PLAY_MODE` dans `src/services/payments/orders.ts`) tant que sa configuration n'est pas terminée.
 * Le catalogue du Legal Kit est produit à partir de ce fichier par `scripts/export-catalog.mjs`.
 */
export const editions: EditionsConfig = {
  currency: "EUR",
  channel: "web (Mollie) et Google Play",
  editions: [
    { id: "discovery", mode: "discovery", ads: null, priceCents: 0, purchase: "free", regions: ["FR-IDF", "FR-OCC"], status: "active" },
    { id: "solo_ads", mode: "solo", ads: true, priceCents: 999, purchase: "one_time", regions: "all", status: "active" },
    { id: "solo_no_ads", mode: "solo", ads: false, priceCents: 1499, purchase: "one_time", regions: "all", status: "active" },
    { id: "family_ads", mode: "family", ads: true, priceCents: 1499, purchase: "one_time", regions: "all", status: "active" },
    { id: "family_no_ads", mode: "family", ads: false, priceCents: 1999, purchase: "one_time", regions: "all", status: "active" },
  ],
};
