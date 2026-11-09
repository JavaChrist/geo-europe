import { ArrowLeft, UserRound } from "lucide-react";
import Link from "next/link";
import content from "@country";
import { AccountPanel } from "@/features/account/AccountPanel";
import { summarizeLevel } from "@/engine/level-unlock";
import { PlayerRewards } from "@/features/album/PlayerRewards";
import { NationalProgress } from "@/features/journey/ProgressPanels";
import { getTranslator } from "@/i18n/translator";

export default function ProfilePage() {
  const { t } = getTranslator();
  const territories = content.territories.map((territory) => ({ id: territory.id, levels: territory.levels.map(summarizeLevel) }));
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 py-10 text-center">
      <header className="fade-in flex w-full flex-col items-center gap-4 rounded-3xl border border-gold/25 bg-surface/60 px-6 py-8 shadow-lg shadow-abyss/40">
        <span className="flex size-16 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
          <UserRound aria-hidden className="size-8 text-gold" />
        </span>
        <h1 className="font-display text-3xl font-semibold">{t("soon.profile.title")}</h1>
        <p className="text-ink-soft">{t("soon.profile.body")}</p>
        <p className="text-sm text-ink-soft/80">{t("soon.profile.playersSoon")}</p>
      </header>
      <AccountPanel />
      <NationalProgress territories={territories} />
      <PlayerRewards />
      <Link
        href="/"
        className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-gold/40 px-5 font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <ArrowLeft aria-hidden className="size-5" />
        {t("common.backHome")}
      </Link>
      <Link
        href="/profil/confidentialite"
        className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-ink-soft underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
      >
        {t("privacy.title")}
      </Link>
    </main>
  );
}
