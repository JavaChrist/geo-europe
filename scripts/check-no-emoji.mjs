// Interdit tout emoji dans l'application. Usage : node scripts/check-no-emoji.mjs [dossiers...]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const TEXT_FILES = new Set([".ts", ".tsx", ".mjs", ".json", ".css", ".html", ".svg"]);
// Extended_Pictographic couvre aussi ces signes, nécessaires aux crédits photo.
const ALLOWED = new Set(["©", "®", "™"]);
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{20E3}]/gu;

function* walk(path) {
  if (statSync(path).isFile()) {
    yield path;
    return;
  }
  for (const name of readdirSync(path)) yield* walk(join(path, name));
}

const roots = process.argv.length > 2 ? process.argv.slice(2) : ["src", "content"];
const found = [];

for (const root of roots) {
  for (const file of walk(root)) {
    if (!TEXT_FILES.has(extname(file))) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        for (const [char] of line.matchAll(EMOJI)) {
          if (!ALLOWED.has(char)) found.push(`${file}:${index + 1} U+${char.codePointAt(0).toString(16).toUpperCase()}`);
        }
      });
  }
}

if (found.length > 0) {
  console.error(`Emoji interdits (${found.length}) :\n${found.join("\n")}`);
  process.exit(1);
}
console.log("Aucun emoji.");
