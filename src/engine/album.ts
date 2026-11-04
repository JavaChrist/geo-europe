/** Album de souvenirs, commun à tous les pays. Cartes et badges se déduisent des résultats enregistrés : rien n'est stocké à part. */
import type { AlbumThemeId, RewardBadge, SouvenirCard, Territory } from "./types.ts";

export const ALBUM_THEMES: readonly AlbumThemeId[] = ["cities", "gastronomy", "heritage", "traditions", "crafts"];

export type AlbumTerritory = Pick<Territory, "id" | "status" | "souvenirCards" | "badges">;

/** Seule l'existence d'un résultat compte : un niveau terminé donne sa carte, quel que soit le score. */
type AlbumRecords = Readonly<Record<string, unknown>>;

export interface CollectionProgress {
  cardsEarned: number;
  cardsTotal: number;
  badgesEarned: number;
  badgesTotal: number;
}

export interface ThemeGroup {
  themeId: AlbumThemeId;
  cards: SouvenirCard[];
}

export interface NewRewards {
  cards: SouvenirCard[];
  badges: RewardBadge[];
}

export const isCardEarned = (card: SouvenirCard, records: AlbumRecords): boolean => records[card.unlock.levelId] !== undefined;

export function isBadgeEarned(badge: RewardBadge, cards: readonly SouvenirCard[], records: AlbumRecords): boolean {
  // La règle du badge de maîtrise reste à définir : il ne se gagne pas encore.
  if (badge.kind !== "collector" || badge.cardIds.length === 0) return false;
  return badge.cardIds.every((id) => {
    const card = cards.find((candidate) => candidate.id === id);
    return card !== undefined && isCardEarned(card, records);
  });
}

/** Territoires présents dans l'album : publiés et avec au moins une carte. */
export const albumCollections = <T extends AlbumTerritory>(territories: readonly T[]): T[] =>
  territories.filter((territory) => territory.status === "published" && territory.souvenirCards.length > 0);

export function summarizeCollections(territories: readonly AlbumTerritory[], records: AlbumRecords): CollectionProgress {
  const cards = territories.flatMap((territory) => territory.souvenirCards);
  const badges = territories.flatMap((territory) => territory.badges.filter((badge) => badge.kind === "collector"));
  return {
    cardsEarned: cards.filter((card) => isCardEarned(card, records)).length,
    cardsTotal: cards.length,
    badgesEarned: badges.filter((badge) => isBadgeEarned(badge, cards, records)).length,
    badgesTotal: badges.length,
  };
}

/** Les mêmes cartes que la vue par territoire, rangées autrement. Un thème sans carte n'apparaît pas. */
export function cardsByTheme(territories: readonly AlbumTerritory[]): ThemeGroup[] {
  const cards = territories.flatMap((territory) => territory.souvenirCards);
  return ALBUM_THEMES.map((themeId) => ({ themeId, cards: cards.filter((card) => card.themeId === themeId) })).filter(
    (group) => group.cards.length > 0,
  );
}

/** Ce qu'un nouveau résultat vient de faire gagner : rien lors d'un rejeu. */
export function newRewards(territories: readonly AlbumTerritory[], before: AlbumRecords, after: AlbumRecords): NewRewards {
  const collections = albumCollections(territories);
  const cards = collections.flatMap((territory) => territory.souvenirCards);
  return {
    cards: cards.filter((card) => !isCardEarned(card, before) && isCardEarned(card, after)),
    badges: collections
      .flatMap((territory) => territory.badges)
      .filter((badge) => !isBadgeEarned(badge, cards, before) && isBadgeEarned(badge, cards, after)),
  };
}
