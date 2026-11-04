import { Award, CalendarDays, ChevronRight, Clock, Flag, Shapes, Swords, Timer, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import content from "@country";
import { availableSpecialChallenges, SPECIAL_CHALLENGES, type SpecialChallengeKind } from "@/engine/special-challenges";
import { challengeListPath } from "@/features/journey/challenge-origin";
import { getTranslator } from "@/i18n/translator";
import { BackLink } from "@/ui/BackLink";

const REGIONAL_ICONS: Record<SpecialChallengeKind, LucideIcon> = { master: Award, chrono: Timer };

function ModeIcon({ icon: Icon, muted = false }: { icon: LucideIcon; muted?: boolean }) {
  return (
    <span className={`flex size-12 shrink-0 items-center justify-center rounded-full border bg-abyss/50 ${muted ? "border-gold/15" : "border-gold/40"}`}>
      <Icon aria-hidden className={`size-6 ${muted ? "text-ink-soft" : "text-gold"}`} />
    </span>
  );
}

function ModeInPreparation({ title, note, badge, icon }: { title: string; note: string; badge: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gold/10 bg-surface/30 p-4">
      <ModeIcon icon={icon} muted />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-lg font-semibold text-ink-soft">{title}</span>
        <span className="text-sm text-ink-soft">{note}</span>
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
          <Clock aria-hidden className="size-4 shrink-0" />
          {badge}
        </span>
      </span>
    </div>
  );
}

export default function ChallengesPage() {
  const { t, tContent } = getTranslator();
  const preparing = t("challenges.preparing");
  const inPreparation = [
    { id: "daily", title: t("challenges.modes.daily.title"), note: t("challenges.modes.daily.note"), icon: CalendarDays },
    { id: "country", title: tContent("country.challengeTitle"), note: t("challenges.modes.country.note"), icon: Flag },
    { id: "themes", title: t("challenges.modes.themes.title"), note: t("challenges.modes.themes.note"), icon: Shapes },
    { id: "family", title: t("challenges.modes.family.title"), note: t("challenges.modes.family.note"), icon: UsersRound },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/60 p-5">
        <ModeIcon icon={Swords} />
        <h1 className="font-display text-3xl font-semibold">{t("challenges.title")}</h1>
        <p className="text-ink-soft">{t("challenges.intro")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">{t("challenges.regionalTitle")}</h2>
        {SPECIAL_CHALLENGES.map((rules) => {
          const title = t(`challenges.regional.${rules.kind}.title`);
          const note = t(`challenges.regional.${rules.kind}.note`);
          const icon = REGIONAL_ICONS[rules.kind];
          const open = content.territories.some((territory) => availableSpecialChallenges(territory).some((candidate) => candidate.kind === rules.kind));
          if (!open) return <ModeInPreparation key={rules.kind} title={title} note={note} badge={preparing} icon={icon} />;
          return (
            <Link
              key={rules.kind}
              href={challengeListPath(rules.slug)}
              className="flex min-h-20 items-center gap-4 rounded-2xl border border-gold/25 bg-surface/60 p-4 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <ModeIcon icon={icon} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-lg font-semibold">{title}</span>
                <span className="text-sm text-ink-soft">{note}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" />
            </Link>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">{t("challenges.otherTitle")}</h2>
        {inPreparation.map((mode) => (
          <ModeInPreparation key={mode.id} title={mode.title} note={mode.note} badge={preparing} icon={mode.icon} />
        ))}
      </section>

      <BackLink href="/" label={t("common.backHome")} />
    </main>
  );
}
