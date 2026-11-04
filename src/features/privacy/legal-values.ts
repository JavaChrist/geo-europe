import content from "@country";
import type { Translator } from "@/i18n/translator";

/** Valeurs insérées dans les textes légaux. Une information manquante s'affiche « à compléter ». */
export function getLegalValues({ t, tContent, formatPrice }: Translator) {
  const { appName, legal, premium } = content.country;
  const { publisher, host, mediator, vat } = legal;
  const missing = t("privacy.toComplete");
  return {
    appName,
    publisher: publisher.tradeName ?? missing,
    entrepreneur: publisher.entrepreneur ?? missing,
    status: publisher.status ?? missing,
    siret: publisher.siret ?? missing,
    address: publisher.address ?? missing,
    phone: publisher.phone ?? missing,
    contact: publisher.supportEmail ?? missing,
    host: host.name ?? missing,
    mediator: mediator.name ?? missing,
    mediatorAddress: mediator.address ?? missing,
    mediatorWebsite: mediator.website ?? missing,
    vatNotice: vat.regime === "franchise" ? t("privacy.identity.vatFranchise") : missing,
    price: formatPrice(premium.priceCents, premium.currency),
    authority: tContent("country.legal.authority"),
    law: tContent("country.legal.governingLaw"),
    consumerLaw: tContent("country.legal.consumerLaw"),
  };
}
