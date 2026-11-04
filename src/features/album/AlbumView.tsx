"use client";

import { Award, BookOpen, Lock } from "lucide-react";
import { useState } from "react";
import { cardsByTheme, isBadgeEarned, isCardEarned, summarizeCollections } from "@/engine/album";
import type { RewardBadge, SouvenirCard } from "@/engine/types";
import { useLevelRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import { AlbumCard } from "./AlbumCard";
import { collections } from "./collections";

type AlbumMode = "territories" | "themes";

/** Retrouver sa vue en revenant du détail d'une carte. Remis à zéro au rechargement. */
const remembered: { mode: AlbumMode; territory: string | null; theme: string | null } = { mode: "territories", territory: null, theme: null };

const themeGroups = cardsByTheme(collections);

function Progress({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-1.5 overflow-hidden rounded-full bg-abyss/60"
    >
      <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${max === 0 ? 0 : Math.round((value / max) * 100)}%` }} />
    </div>
  );
}

function Choice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
        pressed ? "border-gold bg-gold text-abyss" : "border-gold/30 text-ink hover:bg-gold/10"
      }`}
    >
      {children}
    </button>
  );
}

function CardGrid({ cards }: { cards: readonly SouvenirCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <li key={card.id}>
          <AlbumCard card={card} />
        </li>
      ))}
    </ul>
  );
}

function BadgeRow({ badge, cards }: { badge: RewardBadge; cards: readonly SouvenirCard[] }) {
  const { t, tContent } = useTranslation();
  const earned = isBadgeEarned(badge, cards, useLevelRecords());
  const Icon = earned ? Award : Lock;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-3 ${earned ? "border-gold bg-gold/10" : "border-gold/15 bg-abyss/30"}`}>
      <Icon aria-hidden className={`mt-0.5 size-6 shrink-0 ${earned ? "text-gold" : "text-ink-soft"}`} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-ink-soft">{t(`album.badge.${badge.kind}`)}</span>
        <span className="font-semibold">{tContent(badge.nameKey)}</span>
        <span className="text-sm text-ink-soft">{tContent(badge.descriptionKey)}</span>
        <span className={`text-sm font-semibold ${earned ? "text-gold" : "text-ink-soft"}`}>{t(earned ? "album.badge.earned" : "album.badge.locked")}</span>
      </div>
    </div>
  );
}

export function AlbumView() {
  const { t, tContent } = useTranslation();
  const records = useLevelRecords();
  const [mode, setMode] = useState(remembered.mode);
  const [territoryFilter, setTerritoryFilter] = useState(remembered.territory);
  const [themeFilter, setThemeFilter] = useState(remembered.theme);

  const chooseMode = (next: AlbumMode) => {
    remembered.mode = next;
    setMode(next);
  };
  const chooseTerritory = (next: string | null) => {
    remembered.territory = next;
    setTerritoryFilter(next);
  };
  const chooseTheme = (next: string | null) => {
    remembered.theme = next;
    setThemeFilter(next);
  };

  const total = summarizeCollections(collections, records);
  const ofTotal = (value: number, max: number) => t("album.counters.ofTotal", { value, total: max });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-4 rounded-3xl border border-gold/25 bg-surface/60 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
            <BookOpen aria-hidden className="size-6 text-gold" />
          </span>
          <h1 className="font-display text-3xl font-semibold">{t("album.title")}</h1>
        </div>
        <p className="text-ink-soft">{t("album.intro")}</p>
        <dl className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 rounded-2xl border border-gold/15 bg-abyss/30 p-3">
            <dt className="text-sm text-ink-soft">{t("album.counters.cards")}</dt>
            <dd className="font-display text-xl font-semibold text-gold">{ofTotal(total.cardsEarned, total.cardsTotal)}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-gold/15 bg-abyss/30 p-3">
            <dt className="text-sm text-ink-soft">{t("album.counters.badges")}</dt>
            <dd className="font-display text-xl font-semibold text-gold">{ofTotal(total.badgesEarned, total.badgesTotal)}</dd>
          </div>
        </dl>
        <Progress label={t("album.counters.cards")} value={total.cardsEarned} max={total.cardsTotal} />
        <p className="text-sm text-ink-soft">{t("journey.deviceOnly")}</p>
      </section>

      <div role="group" aria-label={t("album.views.label")} className="flex gap-2">
        <Choice pressed={mode === "territories"} onClick={() => chooseMode("territories")}>{t("album.views.territories")}</Choice>
        <Choice pressed={mode === "themes"} onClick={() => chooseMode("themes")}>{t("album.views.themes")}</Choice>
      </div>

      {mode === "territories" ? (
        <>
          <div role="group" aria-label={t("album.filters.territories")} className="flex flex-wrap gap-2">
            <Choice pressed={territoryFilter === null} onClick={() => chooseTerritory(null)}>{t("album.filters.all")}</Choice>
            {collections.map((territory) => (
              <Choice key={territory.id} pressed={territoryFilter === territory.id} onClick={() => chooseTerritory(territory.id)}>
                {tContent(territory.nameKey)}
              </Choice>
            ))}
          </div>
          {collections
            .filter((territory) => territoryFilter === null || territory.id === territoryFilter)
            .map((territory) => {
              const progress = summarizeCollections([territory], records);
              const name = tContent(territory.nameKey);
              return (
                <section key={territory.id} className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h2 className="font-display text-xl font-semibold">{name}</h2>
                    <span className="text-sm font-semibold text-gold">{ofTotal(progress.cardsEarned, progress.cardsTotal)}</span>
                  </div>
                  <Progress label={t("album.collection.progress", { name })} value={progress.cardsEarned} max={progress.cardsTotal} />
                  <CardGrid cards={territory.souvenirCards} />
                  {territory.badges.map((badge) => (
                    <BadgeRow key={badge.id} badge={badge} cards={territory.souvenirCards} />
                  ))}
                </section>
              );
            })}
        </>
      ) : (
        <>
          <div role="group" aria-label={t("album.filters.themes")} className="flex flex-wrap gap-2">
            <Choice pressed={themeFilter === null} onClick={() => chooseTheme(null)}>{t("album.filters.all")}</Choice>
            {themeGroups.map((group) => (
              <Choice key={group.themeId} pressed={themeFilter === group.themeId} onClick={() => chooseTheme(group.themeId)}>
                {t(`album.themes.${group.themeId}`)}
              </Choice>
            ))}
          </div>
          {themeGroups
            .filter((group) => themeFilter === null || group.themeId === themeFilter)
            .map((group) => {
              const name = t(`album.themes.${group.themeId}`);
              const earned = group.cards.filter((card) => isCardEarned(card, records)).length;
              return (
                <section key={group.themeId} className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h2 className="font-display text-xl font-semibold">{name}</h2>
                    <span className="text-sm font-semibold text-gold">{ofTotal(earned, group.cards.length)}</span>
                  </div>
                  <Progress label={t("album.collection.progress", { name })} value={earned} max={group.cards.length} />
                  <CardGrid cards={group.cards} />
                </section>
              );
            })}
        </>
      )}
    </main>
  );
}
