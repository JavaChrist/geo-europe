import content from "@country";
import { freeRegionIds } from "@/engine/entitlements";
import { nationalBadges } from "@/engine/national-challenges";

/** Les six badges des défis nationaux du pays : un national et un par thème. */
export const NATIONAL_BADGES = nationalBadges(content.family.themes);

/** Territoires publiés, seuls à fournir des questions aux défis nationaux. */
export const PUBLISHED_TERRITORIES = content.territories.filter((territory) => territory.status === "published");

/** Noms des régions gratuites de la Découverte, pour les textes qui les citent. */
export function freeRegionNames(tContent: (key: string) => string, locale: string): string {
  const names = freeRegionIds(content.editions).map((id) => {
    const region = content.regions.find((candidate) => candidate.id === id);
    return region ? tContent(region.nameKey) : id;
  });
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
}
