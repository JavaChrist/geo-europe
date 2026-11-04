import { ChevronRight, type LucideIcon, Map as MapIcon, RotateCcw } from "lucide-react";
import Link from "next/link";
import { getLegalValues } from "@/features/privacy/legal-values";
import { PRIVACY_SECTIONS } from "@/features/privacy/sections";
import { getTranslator } from "@/i18n/translator";
import { BackLink } from "@/ui/BackLink";

export default function PrivacyHubPage() {
  const translator = getTranslator();
  const { t } = translator;
  const values = getLegalValues(translator);

  const entries: { href: string; icon: LucideIcon; title: string; summary: string }[] = [
    { href: "/profil/reinitialiser", icon: RotateCcw, title: t("reset.title"), summary: t("reset.summary") },
    ...PRIVACY_SECTIONS.map((section) => ({
      href: `/profil/confidentialite/${section.slug}`,
      icon: section.icon,
      title: t(section.titleKey),
      summary: t(section.summaryKey, values),
    })),
    { href: "/profil/sources", icon: MapIcon, title: t("sources.title"), summary: t("privacy.sourcesSummary") },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold">{t("privacy.title")}</h1>
        <p className="text-ink-soft">{t("privacy.intro")}</p>
      </section>

      <ul className="flex flex-col gap-3">
        {entries.map(({ href, icon: Icon, title, summary }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-4 rounded-2xl border border-gold/25 bg-surface/50 p-4 transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <Icon aria-hidden className="size-6 shrink-0 text-gold" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-ink-soft">{summary}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" />
            </Link>
          </li>
        ))}
      </ul>

      <BackLink href="/profil" label={t("privacy.backToProfile")} />
    </main>
  );
}
