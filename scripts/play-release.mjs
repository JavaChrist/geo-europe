// Envoi d'un Android App Bundle en test interne Google Play, sans dépendance (voir docs/play-release.md).
//
// Simulation par défaut : contrôles locaux seulement, aucun appel réseau, rien n'est modifié dans la Play Console.
// `--send` est la seule façon d'envoyer, et seulement vers la piste « internal ». Cette version n'a aucun chemin
// vers la production, les tests fermés ou ouverts : la piste n'est pas un paramètre.
//
// Usage :
//   node scripts/play-release.mjs [--config <fichier>] [--bundle <aab>]   simulation
//   node scripts/play-release.mjs --send [--config <fichier>]              envoi en test interne
//   node scripts/play-release.mjs --check-config                           contrôle des content/*/play-release.json
//
// Identifiants : compte de service dédié aux versions, fichier JSON hors du dépôt (`credentials` de la config, ou
// la variable PLAY_RELEASE_CREDENTIALS). Jamais le compte de facturation. Aucune clé ni jeton n'est affiché.

import { spawnSync } from "node:child_process";
import { createHash, createSign } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, closeSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

/** Seule piste possible. Ne jamais en faire un paramètre. */
const TRACK = "internal";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const UPLOAD_API = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications";
const REPORTS_ROOT = join(homedir(), ".geo-play", "reports");
const CONFIG_KEYS = new Set([
  "app", "packageName", "bundle", "gradleFile", "uploadCertSha256", "lastUploadedVersionCode",
  "credentials", "billingServiceAccount", "bundleJson", "releaseNotes",
]);
const RELEASE_NOTES_MAX = 500;

// --- Arguments ----------------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { send: false, checkConfig: false, config: null, bundle: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--send") args.send = true;
    else if (arg === "--check-config") args.checkConfig = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--config" || arg === "--bundle") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) fail(`${arg} attend un chemin`);
      args[arg.slice(2)] = value;
    } else if (/^--(track|production|prod|promote|rollout)/.test(arg)) {
      fail(`${arg} refusé : cette version n'envoie qu'en test interne, sans accès à la production`);
    } else fail(`Option inconnue : ${arg}`);
  }
  if (args.send && args.checkConfig) fail("--send et --check-config ne vont pas ensemble");
  return args;
}

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(2);
}

// --- Configuration ------------------------------------------------------------------------------------------------

const projectRoot = () => {
  const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return git.status === 0 ? resolve(git.stdout.trim()) : process.cwd();
};

const expandHome = (path) => (path === "~" || path.startsWith("~/") || path.startsWith("~\\") ? join(homedir(), path.slice(1)) : path);

const isInside = (child, parent) => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/** Chemin affiché : relatif dans le dépôt, absolu ailleurs. */
const shown = (root, path) => (isInside(path, root) ? relative(root, path) : path);

/** Chemin réel quand il existe, pour qu'un lien ne fasse pas passer un fichier du dépôt pour un fichier extérieur. */
const realOrResolved = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

/** Contrôle la forme de la configuration. Renvoie la liste des erreurs, vide si tout va bien. */
export function configErrors(config, root) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) return ["la configuration doit être un objet JSON"];
  for (const key of Object.keys(config)) {
    if (key === "track" || key === "tracks") errors.push("« track » interdit : la piste est toujours « internal »");
    else if (!CONFIG_KEYS.has(key)) errors.push(`clé inconnue « ${key} »`);
  }
  if (typeof config.app !== "string" || !config.app) errors.push("« app » manquant");
  if (typeof config.packageName !== "string" || !/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(config.packageName)) {
    errors.push("« packageName » invalide");
  }
  if (typeof config.bundle !== "string" || !config.bundle.endsWith(".aab")) errors.push("« bundle » doit désigner un fichier .aab");
  if (config.gradleFile !== undefined && typeof config.gradleFile !== "string") errors.push("« gradleFile » invalide");
  if (typeof config.uploadCertSha256 !== "string" || !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(config.uploadCertSha256)) {
    errors.push("« uploadCertSha256 » doit être l'empreinte SHA-256 de la clé d'importation, au format AA:BB:…");
  }
  if (!Number.isInteger(config.lastUploadedVersionCode) || config.lastUploadedVersionCode < 0) {
    errors.push("« lastUploadedVersionCode » doit être un entier positif ou nul");
  }
  if (typeof config.credentials !== "string" || !config.credentials) errors.push("« credentials » manquant");
  else if (isInside(realOrResolved(resolve(root, expandHome(config.credentials))), root)) {
    errors.push("« credentials » doit être hors du dépôt Git");
  }
  if (config.billingServiceAccount !== undefined && (typeof config.billingServiceAccount !== "string" || !config.billingServiceAccount.includes("@"))) {
    errors.push("« billingServiceAccount » invalide");
  }
  if (config.bundleJson !== undefined) {
    if (!Array.isArray(config.bundleJson)) errors.push("« bundleJson » doit être une liste");
    else {
      for (const check of config.bundleJson) {
        if (typeof check?.entry !== "string" || !check.expect || typeof check.expect !== "object") {
          errors.push("chaque « bundleJson » demande « entry » et « expect »");
        }
      }
    }
  }
  if (config.releaseNotes !== undefined) {
    if (!config.releaseNotes || typeof config.releaseNotes !== "object" || Array.isArray(config.releaseNotes)) {
      errors.push("« releaseNotes » doit associer une langue (fr-FR) à un fichier");
    } else {
      for (const [language, file] of Object.entries(config.releaseNotes)) {
        if (!/^[a-z]{2,3}(-[A-Z0-9]{2,3})?$/.test(language)) errors.push(`langue de notes invalide : ${language}`);
        if (typeof file !== "string") errors.push(`notes ${language} : chemin invalide`);
      }
    }
  }
  return errors;
}

function readConfig(path, root) {
  if (!existsSync(path)) fail(`configuration introuvable : ${shown(root, path)}`);
  let config;
  try {
    config = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`configuration illisible (JSON) : ${path}`);
  }
  return config;
}

// --- Lecture de l'AAB (zip) ---------------------------------------------------------------------------------------

function readAt(fd, position, length) {
  const buffer = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const n = readSync(fd, buffer, read, length - read, position + read);
    if (n === 0) break;
    read += n;
  }
  return buffer.subarray(0, read);
}

/** Index du zip : nom de l'entrée vers sa position. Gère le zip64 utile aux gros bundles. */
function zipIndex(fd, size) {
  const tailLength = Math.min(size, 65_557);
  const tail = readAt(fd, size - tailLength, tailLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("fin de zip introuvable");
  let count = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOffset = tail.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || count === 0xffff) {
    const locator = eocd - 20;
    if (locator < 0 || tail.readUInt32LE(locator) !== 0x07064b50) throw new Error("zip64 sans localisateur");
    const record = readAt(fd, Number(tail.readBigUInt64LE(locator + 8)), 56);
    count = Number(record.readBigUInt64LE(32));
    cdSize = Number(record.readBigUInt64LE(40));
    cdOffset = Number(record.readBigUInt64LE(48));
  }
  const cd = readAt(fd, cdOffset, cdSize);
  const entries = new Map();
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.length; n++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error("répertoire central du zip invalide");
    const method = cd.readUInt16LE(p + 10);
    let compressed = cd.readUInt32LE(p + 20);
    let uncompressed = cd.readUInt32LE(p + 24);
    const nameLength = cd.readUInt16LE(p + 28);
    const extraLength = cd.readUInt16LE(p + 30);
    const commentLength = cd.readUInt16LE(p + 32);
    let offset = cd.readUInt32LE(p + 42);
    const name = cd.subarray(p + 46, p + 46 + nameLength).toString("utf8");
    // Champ zip64 : seules les valeurs saturées y figurent, dans cet ordre.
    let e = p + 46 + nameLength;
    const extraEnd = e + extraLength;
    while (e + 4 <= extraEnd) {
      const id = cd.readUInt16LE(e);
      const length = cd.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncompressed === 0xffffffff) {
          uncompressed = Number(cd.readBigUInt64LE(q));
          q += 8;
        }
        if (compressed === 0xffffffff) {
          compressed = Number(cd.readBigUInt64LE(q));
          q += 8;
        }
        if (offset === 0xffffffff) offset = Number(cd.readBigUInt64LE(q));
      }
      e += 4 + length;
    }
    entries.set(name, { method, compressed, uncompressed, offset });
    p = extraEnd + commentLength;
  }
  return entries;
}

function zipEntry(fd, entries, name) {
  const entry = entries.get(name);
  if (!entry) return null;
  const local = readAt(fd, entry.offset, 30);
  if (local.readUInt32LE(0) !== 0x04034b50) throw new Error(`en-tête local invalide : ${name}`);
  const start = entry.offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  const data = readAt(fd, start, entry.compressed);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`compression ${entry.method} non gérée : ${name}`);
}

// --- Manifeste protobuf (format aapt2 des bundles) ----------------------------------------------------------------

function protoFields(buffer) {
  const fields = [];
  let p = 0;
  const varint = () => {
    let value = 0;
    let shift = 0;
    for (;;) {
      if (p >= buffer.length) throw new Error("protobuf tronqué");
      const byte = buffer[p++];
      value += (byte & 0x7f) * 2 ** shift;
      if (byte < 0x80) return value;
      shift += 7;
    }
  };
  while (p < buffer.length) {
    const key = varint();
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) fields.push({ field, value: varint() });
    else if (wire === 2) {
      const length = varint();
      fields.push({ field, bytes: buffer.subarray(p, p + length) });
      p += length;
    } else if (wire === 1) p += 8;
    else if (wire === 5) p += 4;
    else throw new Error(`type protobuf ${wire} inattendu`);
  }
  return fields;
}

/** Package, versionCode et versionName du manifeste `base/manifest/AndroidManifest.xml` d'un bundle. */
export function manifestInfo(buffer) {
  // XmlNode { XmlElement element = 1 } ; XmlElement { string name = 3 ; repeated XmlAttribute attribute = 4 }
  const element = protoFields(buffer).find((f) => f.field === 1)?.bytes;
  if (!element) throw new Error("manifeste sans élément racine");
  const fields = protoFields(element);
  const name = fields.find((f) => f.field === 3)?.bytes?.toString("utf8");
  if (name !== "manifest") throw new Error(`élément racine inattendu : ${name}`);
  const attributes = {};
  for (const f of fields.filter((x) => x.field === 4)) {
    // XmlAttribute { string name = 2 ; string value = 3 ; Item compiled_item = 6 }
    const a = protoFields(f.bytes);
    const attrName = a.find((x) => x.field === 2)?.bytes?.toString("utf8");
    let value = a.find((x) => x.field === 3)?.bytes?.toString("utf8");
    if (!value) {
      // Item { Primitive prim = 7 } ; Primitive { int32 int_decimal_value = 6 ; uint32 int_hexadecimal_value = 7 }
      const item = a.find((x) => x.field === 6)?.bytes;
      const prim = item && protoFields(item).find((x) => x.field === 7)?.bytes;
      const number = prim && protoFields(prim).find((x) => x.field === 6 || x.field === 7);
      if (number && "value" in number) value = String(number.value);
    }
    if (attrName) attributes[attrName] = value;
  }
  return { packageName: attributes.package, versionCode: Number(attributes.versionCode), versionName: attributes.versionName };
}

// --- Signature (outils du JDK) ------------------------------------------------------------------------------------

function jdkTool(name) {
  const home = process.env.JAVA_HOME;
  const candidate = home ? join(home, "bin", process.platform === "win32" ? `${name}.exe` : name) : null;
  return candidate && existsSync(candidate) ? candidate : name;
}

function signatureInfo(bundle) {
  const options = { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  const verify = spawnSync(jdkTool("jarsigner"), ["-J-Duser.language=en", "-verify", bundle], options);
  if (verify.error) return { error: "jarsigner introuvable (JDK requis)" };
  const out = `${verify.stdout}${verify.stderr}`;
  const verified = verify.status === 0 && /^jar verified\./m.test(out);
  const unsigned = /unsigned entries|is unsigned|not signed/i.test(out.split("\n").filter((l) => !l.startsWith("- Entry")).join("\n"));
  const print = spawnSync(jdkTool("keytool"), ["-J-Duser.language=en", "-printcert", "-jarfile", bundle], options);
  if (print.error) return { error: "keytool introuvable (JDK requis)" };
  const printed = `${print.stdout}${print.stderr}`;
  const signers = [...printed.matchAll(/^Signer #\d+:/gm)].length;
  const owner = printed.match(/^Owner: (.+)$/m)?.[1]?.trim() ?? null;
  const fingerprint = printed.match(/SHA256: ([0-9A-F:]{95})/)?.[1] ?? null;
  return { verified, unsigned, signers, owner, fingerprint };
}

// --- Contrôles locaux ---------------------------------------------------------------------------------------------

const sha256File = (path) =>
  new Promise((done, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => done(hash.digest("hex")))
      .on("error", reject);
  });

/** Plus haut versionCode d'un envoi réussi de ce script, d'après les rapports gardés hors du dépôt. */
function lastSentVersionCode(packageName) {
  const dir = join(REPORTS_ROOT, packageName);
  if (!existsSync(dir)) return null;
  let max = null;
  for (const file of readdirSync(dir).filter((f) => f.endsWith("-send.json"))) {
    try {
      const report = JSON.parse(readFileSync(join(dir, file), "utf8"));
      if (report.result === "committed" && Number.isInteger(report.bundle?.versionCode)) max = Math.max(max ?? 0, report.bundle.versionCode);
    } catch {
      // Rapport illisible : ignoré, la Play Console reste la référence au moment de l'envoi.
    }
  }
  return max;
}

function readCredentials(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return { type: raw.type, clientEmail: raw.client_email, privateKey: raw.private_key, projectId: raw.project_id };
}

async function localChecks(config, root, bundleOverride, mode) {
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail });
  const bundle = resolve(root, bundleOverride ?? config.bundle);
  const report = { app: config.app, packageName: config.packageName, track: TRACK, bundle: { path: shown(root, bundle) } };

  // 1. Bundle présent.
  if (!existsSync(bundle)) {
    add("Bundle", "error", `introuvable : ${shown(root, bundle)}`);
    return { checks, report };
  }
  const stat = statSync(bundle);
  report.bundle.sizeBytes = stat.size;
  report.bundle.builtAt = stat.mtime.toISOString();
  add("Bundle", "ok", `${shown(root, bundle)}, ${(stat.size / 1024 / 1024).toFixed(0)} Mo, construit le ${stat.mtime.toLocaleString("fr-FR")}`);

  // 2. Manifeste : package et versionCode du bundle lui-même.
  let manifest = null;
  let fd;
  try {
    fd = openSync(bundle, "r");
    const entries = zipIndex(fd, stat.size);
    const raw = zipEntry(fd, entries, "base/manifest/AndroidManifest.xml");
    if (!raw) throw new Error("base/manifest/AndroidManifest.xml absent : ce n'est pas un bundle");
    manifest = manifestInfo(raw);
    report.bundle.versionCode = manifest.versionCode;
    report.bundle.versionName = manifest.versionName;
    for (const check of config.bundleJson ?? []) {
      const data = zipEntry(fd, entries, check.entry);
      if (!data) {
        add(`Contenu ${check.entry}`, "error", "absent du bundle");
        continue;
      }
      let json;
      try {
        json = JSON.parse(data.toString("utf8"));
      } catch {
        add(`Contenu ${check.entry}`, "error", "JSON illisible");
        continue;
      }
      const wrong = Object.entries(check.expect).filter(([key, value]) => json[key] !== value);
      add(
        `Contenu ${check.entry}`,
        wrong.length ? "error" : "ok",
        wrong.length ? wrong.map(([key, value]) => `${key} = ${JSON.stringify(json[key])}, attendu ${JSON.stringify(value)}`).join(" ; ") : "conforme",
      );
    }
  } catch (error) {
    add("Manifeste", "error", error instanceof Error ? error.message : "illisible");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }

  if (manifest) {
    add(
      "Package",
      manifest.packageName === config.packageName ? "ok" : "error",
      manifest.packageName === config.packageName ? manifest.packageName : `${manifest.packageName} dans le bundle, ${config.packageName} attendu`,
    );

    // 3. versionCode : entier, identique à Gradle, plus grand que le dernier envoyé.
    const vc = manifest.versionCode;
    if (!Number.isInteger(vc) || vc < 1) add("versionCode", "error", "illisible dans le manifeste");
    else {
      const problems = [];
      if (config.gradleFile) {
        const gradlePath = resolve(root, config.gradleFile);
        const gradle = existsSync(gradlePath) ? readFileSync(gradlePath, "utf8") : "";
        const declared = Number(gradle.match(/^\s*versionCode\s+(\d+)/m)?.[1]);
        if (!declared) problems.push(`aucun versionCode lu dans ${config.gradleFile}`);
        else if (declared !== vc) problems.push(`${config.gradleFile} déclare ${declared} : bundle à reconstruire`);
        if (existsSync(gradlePath) && statSync(gradlePath).mtime > stat.mtime) {
          add("Fraîcheur", "warning", `${config.gradleFile} modifié après le bundle`);
        }
      }
      if (vc <= config.lastUploadedVersionCode) {
        problems.push(`${vc} n'est pas plus grand que le dernier versionCode envoyé (${config.lastUploadedVersionCode}, lastUploadedVersionCode)`);
      }
      const sent = lastSentVersionCode(config.packageName);
      if (sent !== null && vc <= sent) problems.push(`${sent} a déjà été envoyé par ce script`);
      add("versionCode", problems.length ? "error" : "ok", problems.length ? problems.join(" ; ") : `${vc} (versionName ${manifest.versionName ?? "?"}), après ${config.lastUploadedVersionCode}`);
    }
  }

  // 4. Signature : intègre, un seul signataire, la clé d'importation attendue.
  const signature = signatureInfo(bundle);
  if (signature.error) add("Signature", "error", signature.error);
  else {
    report.bundle.signer = signature.owner;
    report.bundle.uploadCertSha256 = signature.fingerprint;
    const problems = [];
    if (!signature.verified) problems.push("jarsigner ne vérifie pas le bundle");
    if (signature.unsigned) problems.push("entrées non signées");
    if (signature.signers !== 1) problems.push(`${signature.signers} signataires`);
    if (signature.fingerprint !== config.uploadCertSha256) problems.push(`empreinte ${signature.fingerprint ?? "absente"}, différente de uploadCertSha256`);
    add("Signature", problems.length ? "error" : "ok", problems.length ? problems.join(" ; ") : `${signature.owner}, empreinte conforme`);
  }

  // 5. Notes de version.
  const notes = [];
  for (const [language, file] of Object.entries(config.releaseNotes ?? {})) {
    const path = resolve(root, file);
    if (!existsSync(path)) {
      add(`Notes ${language}`, "error", `introuvable : ${file}`);
      continue;
    }
    const text = readFileSync(path, "utf8").trim();
    if (!text) add(`Notes ${language}`, "error", "vide");
    else if ([...text].length > RELEASE_NOTES_MAX) add(`Notes ${language}`, "error", `${[...text].length} caractères, ${RELEASE_NOTES_MAX} au plus`);
    else {
      notes.push({ language, text });
      add(`Notes ${language}`, "ok", `${[...text].length} caractères`);
    }
  }
  if (!notes.length) add("Notes de version", "warning", "aucune : la version sera envoyée sans notes");
  report.releaseNotes = notes.map((n) => n.language);

  // 6. Identifiants du compte de service de versions : présents, hors du dépôt, jamais le compte de facturation.
  const credentialsPath = resolve(root, expandHome(process.env.PLAY_RELEASE_CREDENTIALS || config.credentials));
  let credentials = null;
  if (isInside(realOrResolved(credentialsPath), root)) add("Identifiants", "error", "le fichier est dans le dépôt : à déplacer hors de Git");
  else if (!existsSync(credentialsPath)) {
    add("Identifiants", mode === "send" ? "error" : "warning", `absents (${credentialsPath}) : envoi impossible`);
  } else {
    try {
      credentials = readCredentials(credentialsPath);
      const problems = [];
      if (credentials.type !== "service_account") problems.push("ce n'est pas une clé de compte de service");
      if (!credentials.clientEmail?.endsWith(".iam.gserviceaccount.com")) problems.push("client_email invalide");
      if (!credentials.privateKey?.includes("PRIVATE KEY")) problems.push("clé privée absente");
      if (credentials.clientEmail && config.billingServiceAccount && credentials.clientEmail === config.billingServiceAccount) {
        problems.push("c'est le compte de facturation : utiliser le compte dédié aux versions");
      }
      if (credentials.clientEmail && /billing/i.test(credentials.clientEmail)) problems.push("compte de facturation refusé");
      report.serviceAccount = credentials.clientEmail ?? null;
      add("Identifiants", problems.length ? "error" : "ok", problems.length ? problems.join(" ; ") : `${credentials.clientEmail} (clé non affichée)`);
    } catch {
      add("Identifiants", "error", "fichier JSON illisible");
    }
  }

  return { checks, report, bundle, manifest, notes, credentials: checks.find((c) => c.name === "Identifiants")?.status === "ok" ? credentials : null };
}

// --- API Google Play (envoi seulement) ----------------------------------------------------------------------------

async function accessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: credentials.clientEmail,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(credentials.privateKey, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!response.ok) throw new Error(`jeton OAuth refusé (HTTP ${response.status})`);
  const data = await response.json();
  if (!data.access_token) throw new Error("jeton OAuth absent");
  return data.access_token;
}

/** Message d'erreur de l'API, sans en-têtes ni jeton. */
async function apiError(response, step) {
  let message = "";
  try {
    message = (await response.json())?.error?.message ?? "";
  } catch {
    // Corps illisible : le code HTTP suffit.
  }
  return new Error(`${step} : HTTP ${response.status}${message ? `, ${message.slice(0, 300)}` : ""}`);
}

async function send(config, local, report) {
  const { bundle, manifest, notes, credentials } = local;
  const pkg = encodeURIComponent(config.packageName);
  const token = await accessToken(credentials);
  const headers = { Authorization: `Bearer ${token}` };
  const json = async (path, init, step) => {
    const response = await fetch(`${API}/${pkg}${path}`, { ...init, headers: { ...headers, ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
    if (!response.ok) throw await apiError(response, step);
    return response.status === 204 ? null : response.json();
  };

  const edit = await json("/edits", { method: "POST", body: "{}" }, "ouverture de l'édition");
  report.editId = edit.id;
  const editPath = `/edits/${encodeURIComponent(edit.id)}`;
  let committed = false;
  try {
    // versionCode : plus grand que tout bundle déjà envoyé et que toute version d'une piste, production comprise (lecture seule).
    const bundles = (await json(`${editPath}/bundles`, {}, "liste des bundles")).bundles ?? [];
    const tracks = (await json(`${editPath}/tracks`, {}, "liste des pistes")).tracks ?? [];
    const onTracks = tracks.flatMap((t) => (t.releases ?? []).flatMap((r) => (r.versionCodes ?? []).map(Number)));
    const playMax = Math.max(0, ...bundles.map((b) => Number(b.versionCode)), ...onTracks);
    report.playMaxVersionCode = playMax;
    if (manifest.versionCode <= playMax) throw new Error(`versionCode ${manifest.versionCode} refusé : Play a déjà ${playMax}`);

    console.log(`Envoi du bundle (${(report.bundle.sizeBytes / 1024 / 1024).toFixed(0)} Mo)…`);
    const start = await fetch(`${UPLOAD_API}/${pkg}${editPath}/bundles?uploadType=resumable`, {
      method: "POST",
      headers: { ...headers, "X-Upload-Content-Type": "application/octet-stream", "X-Upload-Content-Length": String(report.bundle.sizeBytes) },
    });
    if (!start.ok) throw await apiError(start, "début de l'envoi");
    const location = start.headers.get("location");
    if (!location) throw new Error("début de l'envoi : adresse de session absente");
    const upload = await fetch(location, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Length": String(report.bundle.sizeBytes) },
      body: Readable.toWeb(createReadStream(bundle)),
      duplex: "half",
    });
    if (!upload.ok) throw await apiError(upload, "envoi du bundle");
    const uploaded = await upload.json();
    if (Number(uploaded.versionCode) !== manifest.versionCode) throw new Error(`Play a lu le versionCode ${uploaded.versionCode}, ${manifest.versionCode} attendu`);
    report.uploadedSha256 = uploaded.sha256 ?? null;
    if (uploaded.sha256 && uploaded.sha256 !== report.bundle.sha256) throw new Error("empreinte du bundle reçu différente du fichier local");

    const release = {
      name: `${manifest.versionCode} (${manifest.versionName ?? ""})`.trim(),
      versionCodes: [String(manifest.versionCode)],
      status: "completed",
      ...(notes.length ? { releaseNotes: notes } : {}),
    };
    await json(`${editPath}/tracks/${TRACK}`, { method: "PUT", body: JSON.stringify({ track: TRACK, releases: [release] }) }, "piste de test interne");
    await json(`${editPath}:validate`, { method: "POST" }, "validation de l'édition");
    await json(`${editPath}:commit`, { method: "POST" }, "publication de l'édition");
    committed = true;
    report.result = "committed";
  } finally {
    if (!committed) {
      // Rien n'est publié tant que l'édition n'est pas validée : on la supprime pour ne rien laisser en attente.
      await fetch(`${API}/${pkg}${editPath}`, { method: "DELETE", headers }).catch(() => {});
      report.editDeleted = true;
    }
  }
}

// --- Rapport ------------------------------------------------------------------------------------------------------

const LABEL = { ok: "OK       ", warning: "ATTENTION", error: "ERREUR   " };

function printChecks(checks) {
  for (const check of checks) console.log(`  ${LABEL[check.status]} ${check.name} : ${check.detail}`);
}

function saveReport(report, mode) {
  const dir = join(REPORTS_ROOT, report.packageName);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${mode}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

// --- Commandes ----------------------------------------------------------------------------------------------------

function checkAllConfigs(root) {
  const contentDir = join(root, "content");
  const files = existsSync(contentDir)
    ? readdirSync(contentDir).map((code) => join(contentDir, code, "play-release.json")).filter((f) => existsSync(f))
    : [];
  let failed = false;
  for (const file of files) {
    const errors = configErrors(readConfig(file, root), root);
    console.log(`${shown(root, file)} : ${errors.length ? errors.join(" ; ") : "conforme"}`);
    failed ||= errors.length > 0;
  }
  if (!files.length) console.log("Aucun content/*/play-release.json.");
  process.exit(failed ? 1 : 0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
    return;
  }
  const root = projectRoot();
  if (args.checkConfig) return checkAllConfigs(root);

  const configPath = resolve(root, args.config ?? `content/${process.env.GEO_COUNTRY || "fr"}/play-release.json`);
  const config = readConfig(configPath, root);
  const errors = configErrors(config, root);
  if (errors.length) fail(`configuration ${shown(root, configPath)} :\n  ${errors.join("\n  ")}`);

  const mode = args.send ? "send" : "simulation";
  console.log(`${config.app} (${config.packageName}) : ${mode === "send" ? "ENVOI en test interne" : "simulation, aucun appel à Google Play"}`);
  const local = await localChecks(config, root, args.bundle, mode);
  const { checks, report } = local;
  if (local.bundle && existsSync(local.bundle)) report.bundle.sha256 = await sha256File(local.bundle);
  report.mode = mode;
  report.date = new Date().toISOString();
  report.checks = checks;
  printChecks(checks);
  const blocked = checks.some((c) => c.status === "error");

  if (mode === "simulation") {
    report.result = blocked ? "blocked" : "ready";
    const file = saveReport(report, mode);
    console.log(blocked ? "\nRésultat : envoi impossible, corriger les erreurs ci-dessus." : `\nRésultat : prêt. Envoi en test interne avec --send.`);
    console.log("Aucune modification dans la Play Console.");
    console.log(`Rapport : ${file}`);
    process.exit(blocked ? 1 : 0);
  }

  if (blocked) {
    report.result = "blocked";
    console.log(`\nEnvoi annulé avant tout appel à Google Play. Rapport : ${saveReport(report, mode)}`);
    process.exit(1);
  }
  try {
    await send(config, local, report);
    console.log(`\nRésultat : versionCode ${report.bundle.versionCode} publié en test interne (édition ${report.editId}).`);
    console.log(`À faire : passer « lastUploadedVersionCode » à ${report.bundle.versionCode} dans ${shown(root, configPath)}, dans le commit de la version.`);
    console.log(`Rapport : ${saveReport(report, mode)}`);
  } catch (error) {
    report.result = "failed";
    report.error = error instanceof Error ? error.message : "erreur inconnue";
    console.log(`\nRésultat : échec, ${report.error}. ${report.editDeleted ? "Édition supprimée, rien n'est publié." : ""}`);
    console.log(`Rapport : ${saveReport(report, mode)}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
