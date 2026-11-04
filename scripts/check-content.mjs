// Valide le contenu de chaque pays. Usage : node scripts/check-content.mjs [dossier content]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ALBUM_THEMES } from "../src/engine/album.ts";
import { maxScoreOf } from "../src/engine/level-run.ts";

const root = process.argv[2] ?? "content";
const BADGE_KINDS = new Set(["collector", "master"]);
const STATUSES = new Set(["draft", "published"]);
const DIFFICULTIES = new Set([1, 2, 3]);
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

  // Cartes de défi : chaque zone est une réponse possible.
  const gameMaps = new Map();
  const mapsDir = join(dir, "maps");
  if (existsSync(mapsDir)) {
    for (const file of readdirSync(mapsDir).filter((name) => name.endsWith(".json"))) {
      const gameMap = readJson(join(mapsDir, file));
      if (gameMap.id !== basename(file, ".json")) fail(`maps/${file}`, "l'id doit être le nom du fichier");
      gameMaps.set(gameMap.id, new Set(gameMap.zones.map((zone) => zone.id)));
    }
  }

  const creditsById = new Map(credits.map((media) => [media.id, media]));
  // Une photo créditée doit exister, et son crédit doit pouvoir s'afficher en jeu.
  for (const media of credits.filter((candidate) => candidate.file.startsWith("/media/"))) {
    if (!existsSync(join("public", media.file))) fail("media/credits.json", `${media.id} : fichier absent ${media.file}`);
    if (!media.altKey) fail("media/credits.json", `${media.id} : photo sans altKey`);
    if (!(media.width > 0 && media.height > 0)) fail("media/credits.json", `${media.id} : photo sans dimensions`);
  }

  // Une couverture est une photo créditée, quelle que soit la fiche qui l'affiche.
  const checkCover = (where, entry) => {
    if (entry.coverMediaId === undefined) return;
    if (!creditsById.get(entry.coverMediaId)?.file.startsWith("/media/")) fail(where, `couverture sans photo créditée : ${entry.coverMediaId}`);
  };
  for (const file of files) checkCover(`regions/${file}`, readJson(join(dir, "regions", file)));

  const territoriesDir = join(dir, "territories");
  const allCardIds = new Set();
  const allBadgeIds = new Set();
  const indexSource = readFileSync(join(dir, "index.ts"), "utf8");
  const regionFiles = new Map(files.map((file) => [readJson(join(dir, "regions", file)).id, readJson(join(dir, "regions", file))]));
  for (const file of existsSync(territoriesDir) ? readdirSync(territoriesDir).filter((name) => name.endsWith(".json")) : []) {
    const territory = readJson(join(territoriesDir, file));
    const where = `territories/${file}`;
    const keys = [territory.nameKey, territory.descriptionKey];
    const needMedia = (id) => {
      if (!mediaIds.has(id)) fail(where, `média sans crédit : ${id}`);
    };

    if (!indexSource.includes(`./territories/${file}`)) fail(where, "absent de index.ts");
    if (territory.slug !== basename(file, ".json")) fail(where, "le slug doit être le nom du fichier");
    if (territory.kind !== "cultural") fail(where, `type invalide : ${territory.kind}`);
    if (!STATUSES.has(territory.status)) fail(where, `statut invalide : ${territory.status}`);

    const region = regionFiles.get(territory.regionId);
    if (!region) fail(where, `région inconnue : ${territory.regionId}`);
    const subdivisionIds = new Set((region?.subdivisions ?? []).map((subdivision) => subdivision.id));
    for (const id of territory.subdivisionIds) {
      if (!subdivisionIds.has(id)) fail(where, `subdivision hors de la région : ${id}`);
    }
    for (const place of territory.places) {
      keys.push(place.nameKey);
      if (!territory.subdivisionIds.includes(place.subdivisionId)) fail(where, `${place.id} : subdivision hors du territoire`);
    }
    territory.mediaIds.forEach(needMedia);
    checkCover(where, territory);
    const levelIds = new Set(territory.levels.map((level) => level.id));
    for (const card of territory.souvenirCards) {
      const label = `${where} ${card.id}`;
      keys.push(card.nameKey, card.descriptionKey, card.anecdoteKey);
      needMedia(card.mediaId);
      if (!creditsById.get(card.mediaId)?.file.startsWith("/media/")) fail(label, "carte sans photo créditée");
      if (allCardIds.has(card.id)) fail(label, "identifiant de carte déjà utilisé");
      allCardIds.add(card.id);
      if (card.territoryId !== territory.id) fail(label, `territoire incohérent : ${card.territoryId}`);
      if (!ALBUM_THEMES.includes(card.themeId)) fail(label, `thème inconnu : ${card.themeId}`);
      if (card.unlock?.kind !== "level-finished") fail(label, `déblocage inconnu : ${card.unlock?.kind}`);
      else if (!levelIds.has(card.unlock.levelId)) fail(label, `niveau inconnu : ${card.unlock.levelId}`);
    }
    const territoryCardIds = new Set(territory.souvenirCards.map((card) => card.id));
    const badgeKinds = new Set();
    for (const badge of territory.badges) {
      const label = `${where} ${badge.id}`;
      keys.push(badge.nameKey, badge.descriptionKey);
      if (allBadgeIds.has(badge.id)) fail(label, "identifiant de badge déjà utilisé");
      allBadgeIds.add(badge.id);
      if (!BADGE_KINDS.has(badge.kind)) fail(label, `type de badge inconnu : ${badge.kind}`);
      if (badgeKinds.has(badge.kind)) fail(label, `plusieurs badges ${badge.kind} dans le territoire`);
      badgeKinds.add(badge.kind);
      if (badge.cardIds.length === 0) fail(label, "badge sans carte");
      for (const id of badge.cardIds) {
        if (!territoryCardIds.has(id)) fail(label, `carte inconnue : ${id}`);
      }
    }
    if (territory.status === "published" && territory.levels.length === 0) fail(where, "publié sans niveau");

    const questionIds = new Set();
    const prompts = new Map();
    for (const level of territory.levels) {
      const at = `${where} ${level.id}`;
      keys.push(level.nameKey, level.descriptionKey);
      const { one, two, three } = level.stars;
      // Un niveau terminé rapporte toujours au moins une étoile : le premier seuil vaut 0.
      // Une partie compte moins de 8 défis si la banque est insuffisante : les seuils doivent rester atteignables.
      if (!(one === 0 && one < two && two < three && three <= maxScoreOf(level))) fail(at, "seuils d'étoiles invalides");
      if (!DIFFICULTIES.has(level.maxDifficulty) || !DIFFICULTIES.has(level.minDifficulty)) fail(at, "difficulté invalide");
      else if (level.minDifficulty > level.maxDifficulty) fail(at, "difficultés inversées");
      if (level.questions.length === 0) fail(at, "banque de questions vide");
      if (new Set(level.questions.map((challenge) => challenge.id)).size !== level.questions.length) fail(at, "défi en double");
      const groupByPhoto = new Map();
      for (const challenge of level.questions) {
        const label = `${at} ${challenge.id}`;
        const answerIds = challenge.answers.map((answer) => answer.id);
        keys.push(challenge.promptKey, challenge.hintKey, challenge.anecdoteKey, ...challenge.answers.map((answer) => answer.labelKey));
        if (typeof challenge.category !== "string" || !challenge.category) fail(label, "sans catégorie");
        if (!DIFFICULTIES.has(challenge.difficulty)) fail(label, `difficulté invalide : ${challenge.difficulty}`);
        else if (challenge.difficulty > level.maxDifficulty || challenge.difficulty < level.minDifficulty) fail(label, "hors de la difficulté de son niveau : jamais tirée");
        // Une question n'appartient qu'à un niveau, et son historique se réfère à son id.
        if (questionIds.has(challenge.id)) fail(label, "identifiant déjà utilisé dans le territoire");
        questionIds.add(challenge.id);
        for (const messages of Object.values(messagesByLocale)) {
          const prompt = lookup(messages, challenge.promptKey);
          if (typeof prompt !== "string") continue;
          if (prompts.has(prompt)) fail(label, `énoncé déjà utilisé : ${prompts.get(prompt)}`);
          prompts.set(prompt, challenge.id);
        }
        if (new Set(answerIds).size !== answerIds.length) fail(label, "réponse en double");
        if (!answerIds.includes(challenge.answerId)) fail(label, "la bonne réponse n'est pas proposée");
        // Le joker retire deux mauvaises réponses d'un QCM : il lui en faut trois.
        if (challenge.kind !== "map" && answerIds.length !== 4) fail(label, `${answerIds.length} réponses pour 4 attendues`);
        if (challenge.kind === "visual") {
          needMedia(challenge.mediaId);
          if (!territory.mediaIds.includes(challenge.mediaId)) fail(label, "photo absente des médias du territoire");
          if (!creditsById.get(challenge.mediaId)?.file.startsWith("/media/")) fail(label, "photo sans fichier");
          // Une même photo ne doit pas revenir, ni souffler une réponse, dans une partie.
          const photoGroup = challenge.group ?? challenge.id;
          if (groupByPhoto.has(challenge.mediaId) && groupByPhoto.get(challenge.mediaId) !== photoGroup) fail(label, "photo partagée hors de son groupe");
          groupByPhoto.set(challenge.mediaId, photoGroup);
        } else if (challenge.kind === "map") {
          const zones = gameMaps.get(challenge.mapId);
          if (!zones) fail(label, `carte inconnue : ${challenge.mapId}`);
          else if (zones.size !== answerIds.length || answerIds.some((id) => !zones.has(id))) fail(label, "réponses et zones différentes");
        } else if (challenge.kind !== "choice") {
          fail(label, `type invalide : ${challenge.kind}`);
        }
      }
    }

    for (const [locale, messages] of Object.entries(messagesByLocale)) {
      for (const key of keys) {
        if (typeof lookup(messages, key) !== "string") fail(where, `${key} absent de ${locale}.json`);
      }
    }
  }

  for (const [locale, messages] of Object.entries(messagesByLocale)) {
    for (const media of credits.filter((candidate) => candidate.altKey)) {
      if (typeof lookup(messages, media.altKey) !== "string") fail(`locales/${locale}.json`, `${media.altKey} absent`);
    }
    for (const key of ["country.subdivisionsTitle", "country.subdivisionCount.other"]) {
      if (typeof lookup(messages, key) !== "string") fail(`locales/${locale}.json`, `${key} absent`);
    }
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
