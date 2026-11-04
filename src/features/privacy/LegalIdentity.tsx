import content from "@country";
import { getTranslator, type TranslationKey } from "@/i18n/translator";

/** Éditeur et hébergeur, lus dans la configuration du pays. */
export function LegalIdentity() {
  const { t } = getTranslator();
  const { publisher, host } = content.country.legal;

  const groups: { titleKey: TranslationKey; rows: [TranslationKey, string | null][] }[] = [
    {
      titleKey: "privacy.identity.publisherTitle",
      rows: [
        ["privacy.identity.name", publisher.name],
        ["privacy.identity.status", publisher.status],
        ["privacy.identity.siret", publisher.siret],
        ["privacy.identity.address", publisher.address],
        ["privacy.identity.director", publisher.director],
        ["privacy.identity.contactEmail", publisher.contactEmail],
      ],
    },
    {
      titleKey: "privacy.identity.hostTitle",
      rows: [
        ["privacy.identity.name", host.name],
        ["privacy.identity.address", host.address],
      ],
    },
  ];

  return groups.map((group) => (
    <section key={group.titleKey} className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
      <h2 className="font-display text-xl font-semibold">{t(group.titleKey)}</h2>
      <dl className="flex flex-col gap-2 text-sm">
        {group.rows.map(([labelKey, value]) => (
          <div key={labelKey}>
            <dt className="text-ink-soft">{t(labelKey)}</dt>
            <dd>{value ?? t("privacy.toComplete")}</dd>
          </div>
        ))}
      </dl>
    </section>
  ));
}
