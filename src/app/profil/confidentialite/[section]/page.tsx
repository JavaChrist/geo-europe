import { notFound } from "next/navigation";
import content from "@country";
import { getLegalValues } from "@/features/privacy/legal-values";
import { LegalIdentity } from "@/features/privacy/LegalIdentity";
import { LocalResultsDelete, LocalResultsList } from "@/features/privacy/LocalResults";
import { PRIVACY_SECTIONS } from "@/features/privacy/sections";
import { getTranslator } from "@/i18n/translator";
import { BackLink } from "@/ui/BackLink";

// Export statique : seules les rubriques connues existent comme pages.
export const dynamicParams = false;

export function generateStaticParams() {
  return PRIVACY_SECTIONS.map((section) => ({ section: section.slug }));
}

export default async function PrivacySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: slug } = await params;
  const section = PRIVACY_SECTIONS.find((candidate) => candidate.slug === slug);
  if (!section) notFound();

  const translator = getTranslator();
  const { locale, t } = translator;
  const values = getLegalValues(translator);
  const updatedAt = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(content.country.legal.documentsUpdatedAt),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold">{t(section.titleKey)}</h1>
        <p className="text-sm text-ink-soft">{t("privacy.updatedAt", { date: updatedAt })}</p>
      </section>

      {section.showsIdentity && <LegalIdentity />}
      {section.localResults === "view" && <LocalResultsList />}
      {section.localResults === "delete" && <LocalResultsDelete />}

      {section.blocks.map((block) => (
        <section key={block.titleKey} className="flex flex-col gap-2 rounded-3xl border border-gold/25 bg-surface/50 p-5">
          <h2 className="font-display text-xl font-semibold">{t(block.titleKey)}</h2>
          {block.pendsOn && !content.country.legal[block.pendsOn].confirmed && (
            <p className="text-sm text-gold">{t("privacy.pendingValidation")}</p>
          )}
          <p className="text-ink-soft">{t(block.bodyKey, values)}</p>
        </section>
      ))}

      <BackLink href="/profil/confidentialite" label={t("privacy.backToHub")} />
    </main>
  );
}
