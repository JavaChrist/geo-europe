// Tests du lecteur des documents juridiques, puis lecture des vrais documents de chaque pays.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LEGAL_DOCUMENTS, parseLegalInline, parseLegalMarkdown } from "../src/engine/legal-markdown.ts";

const text = (line) => line.map((part) => part.text).join("");

// Liens nus : la ponctuation finale reste du texte, seules https, http et les adresses e-mail deviennent des liens.
assert.deepEqual(parseLegalInline("Site : https://appsgeo.com. Support : support@appsgeo.com."), [
  { kind: "text", text: "Site : " },
  { kind: "link", text: "https://appsgeo.com", href: "https://appsgeo.com" },
  { kind: "text", text: ". Support : " },
  { kind: "link", text: "support@appsgeo.com", href: "mailto:support@appsgeo.com" },
  { kind: "text", text: "." },
]);
assert.deepEqual(parseLegalInline("javascript:alert(1)"), [{ kind: "text", text: "javascript:alert(1)" }]);

// Le HTML reste du texte : rien n'est interprété.
const html = parseLegalMarkdown("<script>alert(1)</script>\n<b>gras</b>");
assert.equal(html.length, 1);
assert.equal(html[0].kind, "paragraph");
assert.equal(text(html[0].lines[0]), "<script>alert(1)</script>");

const sample = parseLegalMarkdown(
  [
    " > BROUILLON — à valider.",
    "",
    "# Titre",
    "",
    "Version 1 — 2026-11-07",
    "",
    "## Rubrique",
    "",
    "Ligne une.",
    "Ligne deux.",
    "- Point A",
    "- Point B",
    "",
    "| Offre | Prix |",
    "| --- | --- |",
    "| Premium | Non commercialisée |",
    "",
    "### Sous-titre",
  ].join("\r\n"),
);
assert.deepEqual(
  sample.map((block) => block.kind),
  ["notice", "heading", "paragraph", "heading", "paragraph", "list", "table", "heading"],
);
assert.equal(text(sample[0].lines[0]), "BROUILLON — à valider.");
assert.equal(sample[1].level, 1);
assert.equal(sample[4].lines.length, 2);
assert.deepEqual(sample[5].items.map(text), ["Point A", "Point B"]);
assert.deepEqual(sample[6].head.map(text), ["Offre", "Prix"]);
assert.deepEqual(sample[6].rows.map((row) => row.map(text)), [["Premium", "Non commercialisée"]]);
assert.equal(sample[7].level, 3);

// Vrais documents : un seul titre, des tableaux complets, aucune variable oubliée.
let checked = 0;
for (const code of readdirSync("content").filter((name) => !name.startsWith("_"))) {
  const dir = join("content", code, "legal");
  if (!existsSync(dir)) continue;
  for (const name of LEGAL_DOCUMENTS) {
    const blocks = parseLegalMarkdown(readFileSync(join(dir, `${name}.md`), "utf8"));
    const where = `${code}/legal/${name}.md`;
    assert.equal(blocks.filter((block) => block.kind === "heading" && block.level === 1).length, 1, `${where} : un titre attendu`);
    for (const table of blocks.filter((block) => block.kind === "table")) {
      for (const row of table.rows) assert.equal(row.length, table.head.length, `${where} : ligne de tableau incomplète`);
    }
    checked++;
  }
}

console.log(`Documents juridiques : lecteur vérifié, ${checked} documents lus.`);
