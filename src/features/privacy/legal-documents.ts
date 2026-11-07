import { readFileSync } from "node:fs";
import { join } from "node:path";
import content from "@country";
import type { LegalDocumentName } from "@/engine/legal-markdown";

export type { LegalDocumentName };

/**
 * Lit un document au moment du build, côté serveur uniquement. Les pages sont prérendues :
 * le texte est déjà dans le HTML, donc lisible sans connexion dans l'application Android.
 */
export function readLegalDocument(name: LegalDocumentName): string {
  return readFileSync(join(process.cwd(), "content", content.country.code, "legal", `${name}.md`), "utf8");
}
