import Link from "next/link";
import content from "@country";
import type { MapRegion } from "@/engine/types";

interface CountryMapProps {
  /** Nom affiché dans les encarts, et lu par les lecteurs d'écran sur une carte interactive. */
  nameOf: (key: string) => string;
  /** Avec une valeur, chaque région devient un lien. Sans, la carte est une simple illustration. */
  label?: string;
  interactive?: boolean;
  onActiveChange?: (regionId: string | null) => void;
}

const regionsById = new Map(content.regions.map((region) => [region.id, region]));

function RegionShape({ region, name }: { region: MapRegion; name: string }) {
  const { inset } = region;
  return (
    <>
      {inset && <rect className="map-cell" x={inset.x} y={inset.y} width={inset.width} height={inset.height} rx={16} />}
      <path className="map-shape" d={region.path} fillRule="evenodd" />
      {region.hitRadius && <circle cx={region.center[0]} cy={region.center[1]} r={region.hitRadius} fill="transparent" />}
      {inset && (
        <text className="map-label" x={inset.x + inset.width / 2} y={inset.y + inset.height - 16} textAnchor="middle">
          {name}
        </text>
      )}
    </>
  );
}

/** Carte du pays courant : aucun tracé ici, tout vient de content/<pays>/map.json. */
export function CountryMap({ nameOf, label, interactive = false, onActiveChange }: CountryMapProps) {
  const { map } = content;

  return (
    <svg
      viewBox={map.viewBox}
      className="country-map block h-auto w-full"
      role={interactive ? "group" : undefined}
      aria-label={interactive ? label : undefined}
      aria-hidden={interactive ? undefined : true}
    >
      {map.regions.map((mapRegion) => {
        const region = regionsById.get(mapRegion.regionId);
        if (!region) return null;
        const name = nameOf(region.nameKey);

        if (!interactive) {
          return (
            <g key={region.id}>
              <RegionShape region={mapRegion} name={name} />
            </g>
          );
        }
        return (
          <Link
            key={region.id}
            href={`/explorer/${region.slug}`}
            aria-label={name}
            className="map-link"
            onPointerEnter={() => onActiveChange?.(region.id)}
            onPointerLeave={() => onActiveChange?.(null)}
            onFocus={() => onActiveChange?.(region.id)}
            onBlur={() => onActiveChange?.(null)}
          >
            <RegionShape region={mapRegion} name={name} />
          </Link>
        );
      })}
    </svg>
  );
}
