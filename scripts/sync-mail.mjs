// Copie les modèles de courriels générés par JavaChrist-Mail-Kit dans content/<pays>/mail/templates.json.
// Usage : node scripts/sync-mail.mjs <pays> <id application du kit> [--kit <dossier du kit>]
// Exemple : node scripts/sync-mail.mjs fr geofr
// Le kit écrit dans un dossier temporaire : son propre dossier templates/ ne change pas.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Modèles utilisés par l'application, et les variables que chacun doit contenir. */
const USED = {
  confirmation: ["ConfirmationURL"],
  "reset-password": ["ConfirmationURL"],
  "purchase-confirmation": ["ProductName", "Amount", "PurchaseDate", "OrderId", "TermsURL", "SiteURL"],
};

const args = process.argv.slice(2);
const kitFlag = args.indexOf("--kit");
const kit = resolve(kitFlag >= 0 ? args.splice(kitFlag, 2)[1] : "../JavaChrist-Mail-Kit");
const [country, appId] = args;

function stop(message) {
  console.error(message);
  process.exit(1);
}

if (!/^[a-z]{2}$/.test(country ?? "") || !existsSync(join("content", country, "country.ts"))) stop("Pays inconnu. Usage : node scripts/sync-mail.mjs <pays> <id application du kit>");
if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(appId ?? "")) stop("Identifiant d'application du kit invalide");
const generator = join(kit, "src", "generator", "generate.js");
if (!existsSync(generator)) stop(`Mail-Kit introuvable : ${kit}`);
if (!existsSync(join(kit, "apps", `${appId}.json`))) stop(`Aucune configuration ${appId} dans le kit : créer d'abord apps/${appId}.json`);

const { generate } = await import(pathToFileURL(generator).href);
if (typeof generate !== "function") stop("Ce Mail-Kit ne propose pas generate(appId, dossier) : le mettre à jour");

const decode = (text) => text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const out = mkdtempSync(join(tmpdir(), "geofr-mail-"));
const templates = {};
try {
  generate(appId, out);
  for (const [kind, variables] of Object.entries(USED)) {
    const html = readFileSync(join(out, `${kind}.html`), "utf8").replace(/\r\n/g, "\n");
    const subject = html.match(/<!-- Sujet : (.+?) -->/)?.[1];
    if (!subject) stop(`${kind}.html : sujet introuvable`);
    const missing = variables.filter((name) => !html.includes(`{{ .${name} }}`));
    if (missing.length) stop(`${kind}.html : variables absentes (${missing.join(", ")})`);
    templates[kind] = { subject: decode(subject), html };
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}

let kitCommit = "inconnu";
try {
  const git = (command) => execSync(command, { cwd: kit, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  // Un kit modifié localement est signalé : les modèles copiés ne correspondent alors à aucun commit publié.
  kitCommit = git("git rev-parse --short HEAD") + (git("git status --porcelain") ? "+modifications" : "");
} catch {
  // Kit hors Git : le commit reste « inconnu ».
}

const target = join("content", country, "mail");
mkdirSync(target, { recursive: true });
writeFileSync(join(target, "templates.json"), `${JSON.stringify({ appId, kitCommit, templates }, null, 2)}\n`);
console.log(`${Object.keys(templates).length} modèles copiés dans ${target}/templates.json (kit ${kitCommit}).`);
