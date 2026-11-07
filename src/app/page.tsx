import { ArrowRight, ChevronRight, Swords, UsersRound, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import content from "@country";
import { getTranslator } from "@/i18n/translator";
import { CountryMap } from "@/ui/map/CountryMap";

function SideCard({ href, title, note, icon: Icon }: { href: string; title: string; note: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="flex min-h-20 items-center gap-4 rounded-2xl border border-gold/25 bg-surface/60 p-4 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
        <Icon aria-hidden className="size-6 text-gold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold">{title}</span>
        <span className="block text-sm text-ink-soft">{note}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" />
    </Link>
  );
}

export default function HomePage() {
  const { t, tContent } = getTranslator();
  const { country, regions } = content;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8 lg:grid-cols-2 lg:items-center lg:gap-10 lg:pt-8">
      <div className="flex flex-col gap-6">
        <section className="fade-in flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
          <Image
            src={country.icons.icon512}
            alt={country.appName}
            width={88}
            height={88}
            className="rounded-3xl shadow-lg shadow-abyss/60 lg:hidden"
            priority
          />
          <p className="font-semibold text-gold">{t("home.tagline")}</p>
          <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">{tContent("country.homeTitle")}</h1>
          <p className="text-ink-soft">{tContent("country.homePitch", { count: regions.length })}</p>
        </section>

        {/* La progression du joueur prendra place ici quand elle existera : rien d'inventé d'ici là. */}

        <div className="hidden flex-col gap-3 lg:flex">
          <SideCard href="/defis" title={t("home.challengeTitle")} note={t("home.challengeNote")} icon={Swords} />
          <SideCard href="/famille" title={t("home.familyTitle")} note={t("home.familyNote")} icon={UsersRound} />
        </div>
      </div>

      <Link
        href="/explorer"
        className="map-card fade-in flex flex-col gap-3 rounded-3xl border border-gold/30 bg-surface/50 p-4 shadow-lg shadow-abyss/40 transition-colors hover:border-gold/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {/* Sur mobile, la largeur limitée garde le bouton visible sans défiler. */}
        <div className="mx-auto w-full max-w-60 sm:max-w-sm lg:max-w-none">
          <CountryMap nameOf={tContent} />
        </div>
        <span className="text-center text-sm text-gold">{t("home.regionCount", { count: regions.length })}</span>
        <span className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-abyss">
          {t("home.exploreCta")}
          <ArrowRight aria-hidden className="size-5" />
        </span>
      </Link>

      <div className="flex flex-col gap-3 lg:hidden">
        <SideCard href="/defis" title={t("home.challengeTitle")} note={t("home.challengeNote")} icon={Swords} />
        <SideCard href="/famille" title={t("home.familyTitle")} note={t("home.familyNote")} icon={UsersRound} />
      </div>
    </main>
  );
}
