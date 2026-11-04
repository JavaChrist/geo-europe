// Valide le contenu de chaque pays. Usage : node scripts/check-content.mjs [dossier content]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2] ?? "content";
const STATUSES = new Set(["draft", "published"]);
const errors = [];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const lookup = (messages, key) => key?.split(".").reduce((node, part) => node?.[part], messages);

// Un dossier préfixé par « _ » contient des données partagées, pas un pays.
for (const code of readdirSync(root).filter((name) => !name.startsWith("_"))) {
  const dir = join(root, code);
  const fail = (where, message) => errors.push(`${code}/${where} : ${message}`);
  const { country } = await import(pathToFileURL(resolve(dir, "country.ts")).href);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(country.legal?.documentsUpdatedAt ?? "")) {
    fail("country.ts", "legal.documentsUpdatedAt absent ou invalide");
  }

  const messagesByLocale = {};
  for (const locale of country.locales) {
    const path = join(dir, "locales", `${locale}.json`);
    if (existsSync(path)) messagesByLocale[locale] = readJson(path);
    else fail("locales", `fichier manquant pour ${locale}`);
  }

  const credits = readJson(join(dir, "media", "credits.json"));
  const mediaIds = new Set();
  for (const media of credits) {
    if (mediaIds.has(media.id)) fail("media/credits.json", `id en double : ${media.id}`);
    mediaIds.add(media.id);
    for (const field of ["id", "file", "titleKey", "author", "license", "source"]) {
      if (!media[field]) fail("media/credits.json", `${media.id ?? "?"} sans ${field}`);
    }
    if (media.sourceUpdatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(media.sourceUpdatedAt)) {
      fail("media/credits.json", `${media.id} : date invalide ${media.sourceUpdatedAt}`);
    }
    for (const [locale, messages] of Object.entries(messagesByLocale)) {
      for (const key of [media.titleKey, media.noteKey].filter(Boolean)) {
        if (typeof lookup(messages, key) !== "string") fail(`locales/${locale}.json`, `${key} absent`);
      }
    }
  }

  const files = readdirSync(join(dir, "regions")).filter((name) => name.endsWith(".json"));
  if (files.length !== country.regionCount) {
    fail("regions", `${files.length} fichiers pour ${country.regionCount} attendus`);
  }

  const seen = new Set();
  const idPattern = new RegExp(`^${code.toUpperCase()}-[0-9A-Z]{1,3}$`);
  for (const file of files) {
    const region = readJson(join(dir, "regions", file));
    const where = `regions/${file}`;
    if (!idPattern.test(region.id ?? "")) fail(where, `id invalide : ${region.id}`);
    if (seen.has(region.id)) fail(where, `id en double : ${region.id}`);
    seen.add(region.id);
    if (region.slug !== basename(file, ".json")) fail(where, "le slug doit être le nom du fichier");
    if (!STATUSES.has(region.status)) fail(where, `statut invalide : ${region.status}`);
    for (const field of ["subdivisions", "questionSetIds", "mediaIds"]) {
      if (!Array.isArray(region[field])) fail(where, `${field} doit être une liste`);
    }
    for (const [locale, messages] of Object.entries(messagesByLocale)) {
      if (typeof lookup(messages, region.nameKey) !== "string") fail(where, `${region.nameKey} absent de ${locale}.json`);
    }
    for (const id of region.mediaIds ?? []) {
      if (!mediaIds.has(id)) fail(where, `média sans crédit : ${id}`);
    }
    if (region.status === "published") {
      if (!region.mapSvg) fail(where, "publiée sans carte");
      if (!region.questionSetIds?.length) fail(where, "publiée sans questions");
      if (!region.mediaIds?.length) fail(where, "publiée sans médias");
    }
  }

  // Chaque région doit figurer une fois sur la carte, et la carte ne doit rien montrer d'autre.
  const mapPath = join(dir, "map.json");
  if (existsSync(mapPath)) {
    const mapIds = readJson(mapPath).regions.map((region) => region.regionId);
    for (const id of seen) {
      if (!mapIds.includes(id)) fail("map.json", `région absente de la carte : ${id}`);
    }
    for (const id of mapIds) {
      if (!seen.has(id)) fail("map.json", `région inconnue : ${id}`);
    }
    if (new Set(mapIds).size !== mapIds.length) fail("map.json", "région en double");
  } else {
    fail("map.json", "fichier manquant");
  }

  for (const [locale, messages] of Object.entries(messagesByLocale)) {
    for (const key of ["country.homeTitle", "country.homePitch", "country.legal.authority", "country.legal.governingLaw", "country.legal.consumerLaw"]) {
      if (typeof lookup(messages, key) !== "string") fail(`locales/${locale}.json`, `${key} absent`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Contenu invalide (${errors.length}) :\n${errors.join("\n")}`);
  process.exit(1);
}
console.log("Contenu valide.");
