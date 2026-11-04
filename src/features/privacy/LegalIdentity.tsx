import content from "@country";
import { getLegalValues } from "@/features/privacy/legal-values";
import { getTranslator, type TranslationKey } from "@/i18n/translator";

interface Row {
  labelKey: TranslationKey;
  value: string | null;
  href?: string;
  pending?: boolean;
}

const linkClass =
  "inline-flex min-h-11 items-center break-all text-gold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-gold";

/** Éditeur, hébergeur et médiateur, lus dans la configuration du pays. */
export function LegalIdentity() {
  const translator = getTranslator();
  const { t } = translator;
  const { publisher, host, mediator, vat } = content.country.legal;
  const { vatNotice } = getLegalValues(translator);

  const groups: { titleKey: TranslationKey; rows: Row[] }[] = [
    {
      titleKey: "privacy.identity.publisherTitle",
      rows: [
        { labelKey: "privacy.identity.tradeName", value: publisher.tradeName },
        { labelKey: "privacy.identity.entrepreneur", value: publisher.entrepreneur },
        { labelKey: "privacy.identity.status", value: publisher.status },
        { labelKey: "privacy.identity.siren", value: publisher.siren },
        { labelKey: "privacy.identity.siret", value: publisher.siret },
        { labelKey: "privacy.identity.registry", value: publisher.registry },
        { labelKey: "privacy.identity.address", value: publisher.address },
        { labelKey: "privacy.identity.director", value: publisher.director },
        { labelKey: "privacy.identity.phone", value: publisher.phone, href: `tel:${publisher.phone?.replaceAll(" ", "")}` },
        { labelKey: "privacy.identity.contactEmail", value: publisher.supportEmail, href: `mailto:${publisher.supportEmail}` },
        { labelKey: "privacy.identity.website", value: publisher.website, href: publisher.website ?? undefined },
        { labelKey: "privacy.identity.vat", value: vatNotice, pending: !vat.confirmed },
      ],
    },
    {
      titleKey: "privacy.identity.hostTitle",
      rows: [
        { labelKey: "privacy.identity.name", value: host.name },
        { labelKey: "privacy.identity.address", value: host.address },
        { labelKey: "privacy.identity.website", value: host.website, href: host.website ?? undefined },
      ],
    },
    {
      titleKey: "privacy.identity.mediatorTitle",
      rows: [
        { labelKey: "privacy.identity.name", value: mediator.name },
        { labelKey: "privacy.identity.address", value: mediator.address },
        { labelKey: "privacy.identity.website", value: mediator.website, href: mediator.website ?? undefined },
      ],
    },
  ];

  return groups.map((group) => (
    <section key={group.titleKey} className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
      <h2 className="font-display text-xl font-semibold">{t(group.titleKey)}</h2>
      <dl className="flex flex-col gap-2 text-sm">
        {group.rows.map(({ labelKey, value, href, pending }) => (
          <div key={labelKey}>
            <dt className="text-ink-soft">{t(labelKey)}</dt>
            <dd>
              {value && href ? (
                <a href={href} className={linkClass}>
                  {value}
                </a>
              ) : (
                (value ?? t("privacy.toComplete"))
              )}
            </dd>
            {pending && <dd className="text-gold">{t("privacy.pendingValidation")}</dd>}
          </div>
        ))}
      </dl>
    </section>
  ));
}
