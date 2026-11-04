import content from "@country";
import type { Translator } from "@/i18n/translator";

/** Valeurs insérées dans les textes légaux. Une information manquante s'affiche « à compléter ». */
export function getLegalValues({ t, tContent }: Translator) {
  const { country } = content;
  const missing = t("privacy.toComplete");
  return {
    appName: country.appName,
    publisher: country.legal.publisher.name ?? missing,
    contact: country.legal.publisher.contactEmail ?? missing,
    host: country.legal.host.name ?? missing,
    authority: tContent("country.legal.authority"),
    law: tContent("country.legal.governingLaw"),
  };
}
