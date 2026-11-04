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
  /** Titre affiché dans « Sources et licences ». */
  titleKey: string;
  /** Précision facultative sur l'usage du média. */
  noteKey?: string;
  author: string;
  license: string;
  source: string;
  /** Date de mise à jour publiée par la source, au format AAAA-MM-JJ. Ne jamais l'estimer. */
  sourceUpdatedAt?: string;
}

/** `null` : information à fournir, jamais à inventer. */
export interface LegalPublisher {
  tradeName: string | null;
  entrepreneur: string | null;
  status: string | null;
  siren: string | null;
  siret: string | null;
  registry: string | null;
  address: string | null;
  director: string | null;
  phone: string | null;
  supportEmail: string | null;
  website: string | null;
}

export interface LegalHost {
  name: string | null;
  address: string | null;
  website: string | null;
}

/** Identité légale d'une application. */
export interface LegalConfig {
  publisher: LegalPublisher;
  host: LegalHost;
  /** `confirmed` : le régime a été validé administrativement. Sinon, la mention est signalée à l'écran. */
  vat: { regime: "franchise" | null; confirmed: boolean };
  /** `confirmed` : l'adhésion de l'éditeur est confirmée pour cette application. Sinon, la rubrique est signalée à l'écran. */
  mediator: { name: string | null; address: string | null; website: string | null; confirmed: boolean };
  /** Date de dernière modification des documents légaux, au format AAAA-MM-JJ. */
  documentsUpdatedAt: string;
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
  legal: LegalConfig;
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
