"use client";

import { Award, ChevronRight, Clock, Lock, type LucideIcon, Play } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import content from "@country";
import { isBadgeEarned } from "@/engine/album";
import {
  areSpecialChallengesUnlocked,
  availableSpecialChallenges,
  challengeKey,
  type SpecialChallengeKind,
} from "@/engine/special-challenges";
import type { Territory } from "@/engine/types";
import { useTranslation } from "@/i18n/I18nProvider";
import { BackLink } from "@/ui/BackLink";
import { challengeEntryHref, markChallengeEntry } from "./challenge-origin";
import { formatBestResult } from "./challenge-time";
import { SPECIAL_ICONS } from "./SpecialChallenges";
import { regionSlugOf, territoryPath } from "./territories";
import { useChallengeRecords, useLevelRecords } from "./useLevelRecords";

const CARD_CLASS = "flex flex-col gap-3 rounded-3xl border p-5";
const LINK_CLASS = `${CARD_CLASS} border-gold/25 bg-surface/50 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold`;

function CardHeader({ name, status, icon: Icon, earned = false }: { name: string; status: string; icon: LucideIcon; earned?: boolean }) {
  return (
    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="font-display text-xl font-semibold">{name}</span>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${earned ? "border-gold bg-gold/10 font-semibold text-gold" : "border-gold/30 text-ink-soft"}`}>
        <Icon aria-hidden className="size-4 shrink-0" />
        {status}
      </span>
    </span>
  );
}

function CardAction({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 font-semibold text-gold">
      {children}
      <ChevronRight aria-hidden className="ml-auto size-5" />
    </span>
  );
}

function TerritoryEntry({ territory, kind }: { territory: Territory; kind: SpecialChallengeKind }) {
  const { t, tContent } = useTranslation();
  const records = useLevelRecords();
  const results = useChallengeRecords();
  const name = tContent(territory.nameKey);
  const rules = availableSpecialChallenges(territory).find((candidate) => candidate.kind === kind);

  if (!rules) {
    return (
      <div className={`${CARD_CLASS} border-gold/10 bg-surface/30`}>
        <CardHeader name={name} status={t("challenges.preparing")} icon={Clock} />
      </div>
    );
  }

  const path = territoryPath(regionSlugOf(territory), territory.slug);
  const levelIds = territory.levels.map((level) => level.id);

  if (!areSpecialChallengesUnlocked(levelIds, records)) {
    const done = levelIds.filter((id) => records[id] !== undefined).length;
    return (
      <Link href={path} className={LINK_CLASS}>
        <CardHeader name={name} status={t("challenges.status.locked")} icon={Lock} />
        <span className="text-sm text-ink-soft">{t("journey.specials.levelsDone", { done, total: levelIds.length })}</span>
        <CardAction>{t("challenges.openTerritory")}</CardAction>
      </Link>
    );
  }

  const record = results[challengeKey(territory.id, kind)];
  const badge = kind === "master" ? territory.badges.find((candidate) => candidate.kind === "master") : undefined;
  const earned = badge !== undefined && isBadgeEarned(badge, territory.souvenirCards, records, results);

  return (
    <Link href={challengeEntryHref(`${path}/defis/${rules.slug}`, "defis")} onClick={markChallengeEntry} className={LINK_CLASS}>
      <CardHeader
        name={name}
        status={earned ? t("challenges.status.badge") : t("challenges.status.available")}
        icon={earned ? Award : Play}
        earned={earned}
      />
      {earned && badge && <span className="font-semibold">{tContent(badge.nameKey)}</span>}
      {record ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{formatBestResult(t, record, rules.questions)}</span>
          <span className="text-ink-soft">{t("journey.plays", { count: record.plays })}</span>
        </span>
      ) : (
        <span className="text-sm text-ink-soft">{t("journey.specials.notPlayed")}</span>
      )}
      <CardAction>{t(record ? "journey.replay" : "journey.play")}</CardAction>
    </Link>
  );
}

/** État réel de chaque territoire pour un défi. Les entrées ouvrent les pages du parcours : il n'y a qu'un seul défi. */
export function RegionalChallenges({ kind }: { kind: SpecialChallengeKind }) {
  const { t } = useTranslation();
  const Icon = SPECIAL_ICONS[kind];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/60 p-5">
        <span className="flex size-12 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
          <Icon aria-hidden className="size-6 text-gold" />
        </span>
        <h1 className="font-display text-3xl font-semibold">{t(`challenges.regional.${kind}.title`)}</h1>
        <p className="text-ink-soft">{t(`challenges.regional.${kind}.intro`)}</p>
      </section>

      {content.territories.map((territory) => (
        <TerritoryEntry key={territory.id} territory={territory} kind={kind} />
      ))}

      <p className="text-sm text-ink-soft">{t("journey.deviceOnly")}</p>
      <BackLink href="/defis" label={t("challenges.backToHub")} />
    </main>
  );
}
