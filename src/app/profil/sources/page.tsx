import { ExternalLink } from "lucide-react";
import content from "@country";
import { getTranslator } from "@/i18n/translator";
import { BackLink } from "@/ui/BackLink";

export default function SourcesPage() {
  const { locale, t, tContent } = getTranslator();
  // Date seule, lue en UTC pour ne pas changer de jour selon le fuseau de l'appareil.
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold">{t("sources.title")}</h1>
        <p className="text-ink-soft">{t("sources.intro")}</p>
      </section>

      <ul className="flex flex-col gap-4">
        {content.credits.map((credit) => (
          <li key={credit.id} className="fade-in flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
            <h2 className="font-display text-xl font-semibold">{tContent(credit.titleKey)}</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-ink-soft">{t("sources.author")}</dt>
                <dd>{credit.author}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">{t("sources.license")}</dt>
                <dd>{credit.license}</dd>
              </div>
              {credit.sourceUpdatedAt && (
                <div>
                  <dt className="text-ink-soft">{t("sources.updatedAt")}</dt>
                  <dd>
                    <time dateTime={credit.sourceUpdatedAt}>{dateFormat.format(new Date(credit.sourceUpdatedAt))}</time>
                  </dd>
                </div>
              )}
            </dl>
            {credit.noteKey && <p className="text-sm text-ink-soft">{tContent(credit.noteKey)}</p>}
            <a
              href={credit.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl text-sm text-gold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-gold"
            >
              {t("sources.viewSource")}
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </li>
        ))}
      </ul>

      <BackLink href="/profil/confidentialite" label={t("privacy.backToHub")} />
    </main>
  );
}
