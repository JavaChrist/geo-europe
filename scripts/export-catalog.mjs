// Écrit le catalogue d'un pays dans JavaChrist-Legal-Kit, à partir de content/<pays>/editions.ts.
// Usage : node scripts/export-catalog.mjs <pays> [--kit <dossier du kit>]
// Exemple : node scripts/export-catalog.mjs fr
// Seules les éditions payantes sont transmises. Aucun produit Mollie ou Google Play n'est créé.
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogJson, kitCatalogFor } from "./kit-catalog.mjs";

const args = process.argv.slice(2);
const kitFlag = args.indexOf("--kit");
const kit = resolve(kitFlag >= 0 ? args.splice(kitFlag, 2)[1] : "../JavaChrist-Legal-Kit");
const [country] = args;

if (!/^[a-z]{2}$/.test(country ?? "") || !existsSync(join("content", country, "editions.ts"))) {
  console.error("Pays inconnu ou sans editions.ts. Usage : node scripts/export-catalog.mjs <pays>");
  process.exit(1);
}
if (!existsSync(join(kit, "catalogs"))) {
  console.error(`Legal Kit introuvable : ${kit}`);
  process.exit(1);
}

const { appId, catalog } = await kitCatalogFor(country);
const target = join(kit, "catalogs", `${appId}.json`);
writeFileSync(target, catalogJson(catalog));
console.log(`${catalog.offers.length} éditions payantes écrites dans ${target}.`);
console.log(`Ensuite, dans le kit : incrémenter version dans apps/${appId}.json, puis npm run generate -- --app ${appId}.`);
