import type { FamilyContent } from "../../src/engine/types.ts";

/**
 * Thèmes du Mode Famille en France. Chaque thème regroupe des catégories de questions existantes :
 * il n'apporte aucune question, et une catégorie absente de toutes les questions est signalée par check:content.
 */
export const family: FamilyContent = {
  themes: [
    { id: "geographie", nameKey: "familyScopes.themes.geographie", categories: ["geographie", "departements", "reperes", "nature", "mer", "paysages"] },
    { id: "villes-patrimoine", nameKey: "familyScopes.themes.villesPatrimoine", categories: ["villes", "villes-art", "monuments", "patrimoine"] },
    { id: "histoire", nameKey: "familyScopes.themes.histoire", categories: ["histoire", "memoire", "personnalites"] },
    {
      id: "gastronomie",
      nameKey: "familyScopes.themes.gastronomie",
      categories: ["gastronomie", "plats", "douceurs", "terroir", "boissons", "fromages", "vigne", "fruits"],
    },
    { id: "traditions", nameKey: "familyScopes.themes.traditions", categories: ["traditions", "savoir-faire", "sports"] },
  ],
};
