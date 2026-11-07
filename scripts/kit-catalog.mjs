// Catalogue du Legal Kit calculé à partir de content/<pays>/editions.ts et des noms d'éditions de l'interface.
// Partagé par scripts/export-catalog.mjs (écriture) et scripts/check-content.mjs (comparaison).
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildKitCatalog } from "../src/engine/editions.ts";

export async function kitCatalogFor(code) {
  const dir = resolve("content", code);
  const { country } = await import(pathToFileURL(join(dir, "country.ts")).href);
  const { editions } = await import(pathToFileURL(join(dir, "editions.ts")).href);
  const messages = JSON.parse(readFileSync(join("src", "i18n", "locales", `${country.defaultLocale}.json`), "utf8"));
  const fill = (value) => value.replaceAll("{appName}", country.appName);
  const catalog = buildKitCatalog(editions, {
    name: (id) => `${country.appName} — ${messages.editions[id].name}`,
    description: (id) => fill(messages.editions[id].description),
  });
  return { appId: country.legal.kitAppId, catalog };
}

export const catalogJson = (catalog) => `${JSON.stringify(catalog, null, 2)}\n`;
