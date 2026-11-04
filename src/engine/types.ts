/** Modèle de contenu commun à tous les pays de la collection. */

export type RegionStatus = "draft" | "published";

export interface Subdivision {
  /** Code officiel, par exemple un département français. */
  id: string;
  nameKey: string;
}

export interface Region {
  /** Code ISO 3166-2 : FR-OCC, DE-BY, ES-AN. Ne change jamais. */
  id: string;
  /** Identique au nom du fichier de la région. */
  slug: string;
  nameKey: string;
  subdivisions: Subdivision[];
  /** Obligatoire pour publier. */
  mapSvg: string | null;
  questionSetIds: string[];
  mediaIds: string[];
  status: RegionStatus;
}

export interface MediaCredit {
  id: string;
  file: string;
  author: string;
  license: string;
  source: string;
}

export interface CountryConfig {
  /** Code du dossier de contenu, identique à GEO_COUNTRY. */
  code: string;
  appName: string;
  androidPackage: string;
  locales: string[];
  defaultLocale: string;
  regionCount: number;
  premium: { priceCents: number; currency: string };
  icons: { favicon: string; faviconSvg: string; apple: string; icon192: string; icon512: string };
  themeColor: string;
  backgroundColor: string;
}

export interface MapRegion {
  regionId: string;
  path: string;
  /** x, y, largeur, hauteur dans le repère de la carte. */
  bbox: [number, number, number, number];
  center: [number, number];
  /** Zone tactile élargie pour une région trop petite au doigt. */
  hitRadius?: number;
  /** Cadre d'un territoire présenté à part de la carte principale, par exemple l'outre-mer. */
  inset?: { x: number; y: number; width: number; height: number };
}

/** Carte du pays, générée par scripts/build-map.mjs. */
export interface CountryMap {
  viewBox: string;
  regions: MapRegion[];
}

export type ContentMessages = Record<string, unknown>;

export interface CountryContent {
  country: CountryConfig;
  regions: Region[];
  map: CountryMap;
  credits: MediaCredit[];
  /** Textes propres au pays, par langue. */
  messages: Record<string, ContentMessages>;
}
