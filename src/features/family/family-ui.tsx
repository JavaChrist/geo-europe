"use client";

import { useSyncExternalStore } from "react";
import content from "@country";
import type { FamilyColor, FamilyPlayer, FamilyScope, FamilyStanding } from "@/engine/family";
import { useTranslation } from "@/i18n/I18nProvider";
import { EMPTY_FAMILY_DATA, type FamilyData, readFamilyData, subscribeToFamilyData } from "@/services/family-storage";

const readData = () => readFamilyData(content.country.code);
const readServerData = () => EMPTY_FAMILY_DATA;

/** Joueurs, historique et partie en cours de cet appareil. Vide au rendu serveur, puis à jour dès l'hydratation. */
export function useFamilyData(): FamilyData {
  return useSyncExternalStore(subscribeToFamilyData, readData, readServerData);
}

/** Pastille du joueur : sa couleur et son initiale, faute de photo de profil. Texte foncé sur fond clair, contraste AA. */
const COLOR_STYLES: Record<FamilyColor, string> = {
  gold: "bg-gold",
  sky: "bg-sky",
  rose: "bg-rose-300",
  emerald: "bg-emerald-300",
  violet: "bg-violet-300",
  orange: "bg-orange-300",
};

const SIZES = { sm: "size-8 text-sm", md: "size-11 text-lg", lg: "size-20 text-3xl" } as const;

export function PlayerBadge({ player, size = "md" }: { player: Pick<FamilyPlayer, "name" | "color">; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-abyss ${COLOR_STYLES[player.color]} ${SIZES[size]}`}
    >
      {Array.from(player.name.trim())[0]?.toLocaleUpperCase() ?? ""}
    </span>
  );
}

/** Nom affiché du choix de questions : tout le pays, un thème ou un parcours. */
export function useScopeName(): (scope: FamilyScope) => string {
  const { tContent } = useTranslation();
  return (scope) => {
    if (scope.kind === "country") return tContent("familyScopes.wholeCountry");
    if (scope.kind === "theme") {
      const theme = content.family.themes.find((candidate) => candidate.id === scope.themeId);
      return theme ? tContent(theme.nameKey) : scope.themeId;
    }
    const territory = content.territories.find((candidate) => candidate.id === scope.territoryId);
    return territory ? tContent(territory.nameKey) : scope.territoryId;
  };
}

/** « Léa, Tom et Inès », dans la langue de l'interface. */
/** Liste lisible : « Léa, Tom et Zoé », ou « rapide ou classique » avec `disjunction`. */
export function useNameList(type: "conjunction" | "disjunction" = "conjunction"): (names: readonly string[]) => string {
  const { locale } = useTranslation();
  return (names) => new Intl.ListFormat(locale, { type }).format(names);
}

interface StandingsProps {
  standings: readonly FamilyStanding[];
  /** Points gagnés pendant la manche, affichés à côté du total. */
  roundPoints?: Record<string, number>;
  detailed?: boolean;
}

/** Classement des joueurs. Les ex æquo partagent leur rang. */
export function FamilyStandings({ standings, roundPoints, detailed = false }: StandingsProps) {
  const { t } = useTranslation();
  const tied = (rank: number) => standings.filter((row) => row.rank === rank).length > 1;

  return (
    <ol className="flex flex-col gap-2" aria-label={t("family.standings.title")}>
      {standings.map((row) => (
        <li
          key={row.player.id}
          className={`flex items-center gap-3 rounded-2xl border p-3 ${row.rank === 1 ? "border-gold/60 bg-gold/10" : "border-gold/15 bg-abyss/30"}`}
        >
          <span className="w-6 shrink-0 text-center font-display text-xl font-semibold text-gold">
            {t("family.standings.rank", { rank: row.rank })}
          </span>
          <PlayerBadge player={row.player} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{row.player.name}</span>
            {tied(row.rank) && <span className="text-sm text-ink-soft">{t("family.standings.tied")}</span>}
            {detailed && (
              <span className="text-sm text-ink-soft">
                {[
                  t("family.standings.correct", { count: row.correct }),
                  t("family.standings.hints", { count: row.hints }),
                  t("family.standings.jokers", { count: row.jokers }),
                ].join(", ")}
              </span>
            )}
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="font-semibold">{t("family.standings.points", { count: row.points })}</span>
            {roundPoints && <span className="text-sm text-ink-soft">{t("family.standings.roundPoints", { count: roundPoints[row.player.id] ?? 0 })}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 font-semibold text-abyss transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:bg-surface-light disabled:text-ink-soft/70";
export const secondaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/40 px-5 font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
export const card = "fade-in flex flex-col gap-4 rounded-3xl border border-gold/25 bg-surface/50 p-5";
