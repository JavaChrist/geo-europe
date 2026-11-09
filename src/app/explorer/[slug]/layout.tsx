import type { ReactNode } from "react";
import content from "@country";
import { RegionGate } from "@/features/account/RegionGate";
import { administrativeTerritoryOf, territoriesOf } from "@/features/journey/territories";

/** Toutes les pages jouables d'une région (parcours, niveaux, défis) passent par ce verrou unique. */
export default async function RegionLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = content.regions.find((candidate) => candidate.slug === slug);
  // Une région sans parcours n'a rien à verrouiller : sa page « en préparation » reste visible.
  const playable = region && (administrativeTerritoryOf(region.id) || territoriesOf(region.id).length > 0);
  if (!region || !playable) return children;
  return <RegionGate regionId={region.id}>{children}</RegionGate>;
}
