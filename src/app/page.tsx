import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import content from "@country";
import { getTranslator } from "@/i18n/translator";

export default function HomePage() {
  const { t, tContent } = getTranslator();
  const { country, regions } = content;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">{country.appName}</h1>
        <p className="text-lg text-ink-soft">{t("home.tagline")}</p>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="regions-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="regions-title" className="font-display text-2xl font-semibold">
            {t("home.regionsTitle")}
          </h2>
          <p className="text-gold">{t("home.regionCount", { count: regions.length })}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((region) => (
            <li key={region.id} className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-surface/70 p-4">
              <MapPin aria-hidden className="size-6 shrink-0 text-gold" />
              <div className="min-w-0">
                <p className="font-semibold">{tContent(region.nameKey)}</p>
                <p className="text-sm text-ink-soft">
                  {t(region.status === "published" ? "home.statusPublished" : "home.statusDraft")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/demo"
        className="inline-flex min-h-12 items-center gap-2 self-start rounded-xl bg-gold px-5 font-semibold text-abyss transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {t("home.demoLink")}
        <ArrowRight aria-hidden className="size-5" />
      </Link>
    </main>
  );
}
