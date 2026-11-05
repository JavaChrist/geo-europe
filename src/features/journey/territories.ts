import content from "@country";
import type { Region, Territory } from "@/engine/types";

export const territoriesOf = (regionId: string): Territory[] =>
  content.territories.filter((territory) => territory.regionId === regionId);

/** Une région sans contenu propre reste « en préparation », mais peut déjà donner accès à un parcours. */
export const hasPlayableTerritory = (regionId: string): boolean =>
  territoriesOf(regionId).some((territory) => territory.status === "published");

/** Le parcours qui tient lieu de région, quand la région n'a pas de territoires culturels à choisir. */
export const administrativeTerritoryOf = (regionId: string): Territory | undefined =>
  territoriesOf(regionId).find((territory) => territory.kind === "administrative");

export function findTerritory(regionSlug: string, territorySlug: string): { region: Region; territory: Territory } | null {
  const region = content.regions.find((candidate) => candidate.slug === regionSlug);
  const territory = region && territoriesOf(region.id).find((candidate) => candidate.slug === territorySlug);
  return region && territory ? { region, territory } : null;
}

export function regionSlugOf(territory: Territory): string {
  const region = content.regions.find((candidate) => candidate.id === territory.regionId);
  if (!region) throw new Error(`Région introuvable : ${territory.regionId}`);
  return region.slug;
}

export const territoryPath = (regionSlug: string, territorySlug: string) => `/explorer/${regionSlug}/${territorySlug}`;
