/**
 * Lecture des documents produits par JavaChrist-Legal-Kit.
 *
 * Seul le sous-ensemble utilisé par les modèles du kit est reconnu : titres, paragraphes, listes,
 * tableaux, encadré « > » et liens nus (https et adresses e-mail). Aucun HTML brut n'est interprété :
 * le résultat ne contient que du texte, affiché ensuite comme tel.
 */

/** Les cinq documents publics du kit. `rapport.json` et `snapshot.json` restent dans le kit. */
export const LEGAL_DOCUMENTS = ["confidentialite", "conditions-utilisation", "conditions-vente", "mentions-legales", "droits-rgpd"] as const;
export type LegalDocumentName = (typeof LEGAL_DOCUMENTS)[number];

export type LegalInline = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };
export type LegalLine = LegalInline[];

export type LegalBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: LegalLine }
  | { kind: "paragraph"; lines: LegalLine[] }
  | { kind: "list"; items: LegalLine[] }
  | { kind: "notice"; lines: LegalLine[] }
  | { kind: "table"; head: LegalLine[]; rows: LegalLine[][] };

const LINK = /https:\/\/[^\s<>]+|http:\/\/[^\s<>]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;
const TABLE_SEPARATOR = /^\|(\s*:?-+:?\s*\|)+$/;

export function parseLegalInline(text: string): LegalLine {
  const result: LegalLine = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    let link = match[0];
    const trailing = link.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    if (trailing) link = link.slice(0, -trailing.length);
    const start = match.index;
    if (start > last) result.push({ kind: "text", text: text.slice(last, start) });
    const href = link.includes("@") && !link.startsWith("http") ? `mailto:${link}` : link;
    result.push({ kind: "link", text: link, href });
    last = start + link.length;
  }
  if (last < text.length) result.push({ kind: "text", text: text.slice(last) });
  return result;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => parseLegalInline(cell.trim()));

export function parseLegalMarkdown(source: string): LegalBlock[] {
  const lines = source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  const blocks: LegalBlock[] = [];
  let index = 0;

  const collect = (accepts: (line: string) => boolean) => {
    const taken: string[] = [];
    for (let line = lines[index]; line !== undefined && accepts(line); line = lines[++index]) taken.push(line);
    return taken;
  };

  for (let line = lines[index]; line !== undefined; line = lines[index]) {
    if (!line) {
      index++;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const [, marks = "#", title = ""] = heading;
      blocks.push({ kind: "heading", level: marks.length as 1 | 2 | 3, text: parseLegalInline(title) });
      index++;
    } else if (line.startsWith(">")) {
      const taken = collect((candidate) => candidate.startsWith(">"));
      blocks.push({ kind: "notice", lines: taken.map((item) => parseLegalInline(item.replace(/^>\s?/, ""))) });
    } else if (line.startsWith("|")) {
      const rows = collect((candidate) => candidate.startsWith("|")).filter((row) => !TABLE_SEPARATOR.test(row.replace(/\s/g, "")));
      const [head = [], ...body] = rows.map(cells);
      blocks.push({ kind: "table", head, rows: body });
    } else if (line.startsWith("- ")) {
      const taken = collect((candidate) => candidate.startsWith("- "));
      blocks.push({ kind: "list", items: taken.map((item) => parseLegalInline(item.slice(2))) });
    } else {
      const taken = collect((candidate) => Boolean(candidate) && !/^(#{1,3}\s|>|\||- )/.test(candidate));
      blocks.push({ kind: "paragraph", lines: taken.map(parseLegalInline) });
    }
  }
  return blocks;
}
