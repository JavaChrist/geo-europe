/** Modèle de contenu commun à tous les pays de la collection. */

export type RegionStatus = "draft" | "published";

export interface Subdivision {
  /** Code officiel, par exemple un département français. */
  id: string;
  nameKey: string;
}

/** Ce que la fiche d'une région ou d'un territoire peut afficher en tête de page. */
interface WithCover {
  /** Photo de couverture, créditée dans media/credits.json. Facultative : la fiche s'affiche sans. */
  coverMediaId?: string;
}

export interface Region extends WithCover {
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
  /** Adresse du texte de la licence, quand elle l'exige pour réutiliser le média. */
  licenseUrl?: string;
  /** Date de mise à jour publiée par la source, au format AAAA-MM-JJ. Ne jamais l'estimer. */
  sourceUpdatedAt?: string;
  /** Description d'une photo pour les lecteurs d'écran. Elle ne doit pas donner la réponse d'un défi. */
  altKey?: string;
  /** Dimensions réelles d'une photo, en pixels : elles fixent ses proportions à l'écran. */
  width?: number;
  height?: number;
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

/** Zone cliquable d'une carte de défi. Son id est celui d'une réponse. */
export interface GameMapZone {
  id: string;
  path: string;
}

/** Carte d'un défi, générée par scripts/build-game-maps.mjs. */
export interface GameMap {
  id: string;
  viewBox: string;
  zones: GameMapZone[];
}

export interface ChallengeAnswer {
  id: string;
  labelKey: string;
}

/** 1 : accessible, 2 : intermédiaire, 3 : difficile. */
export type QuestionDifficulty = 1 | 2 | 3;

interface ChallengeBase {
  /** Identifiant stable : l'historique du joueur s'y réfère. */
  id: string;
  /** Thème de la question, libre pour chaque pays. Sert à varier une partie. */
  category: string;
  difficulty: QuestionDifficulty;
  /** Les questions d'un même groupe se donnent la réponse : une seule par partie. */
  group?: string;
  promptKey: string;
  answers: ChallengeAnswer[];
  /** Id de la bonne réponse. */
  answerId: string;
  /** Affiché après une première erreur. */
  hintKey: string;
  /** Affichée une fois le défi terminé. */
  anecdoteKey: string;
}

export interface ChoiceChallenge extends ChallengeBase {
  kind: "choice";
}

export interface VisualChallenge extends ChallengeBase {
  kind: "visual";
  /** Photo créditée dans media/credits.json. */
  mediaId: string;
}

export interface MapChallenge extends ChallengeBase {
  kind: "map";
  /** Carte de content/<pays>/maps/. Chaque réponse correspond à une zone. */
  mapId: string;
}

export type LevelChallenge = ChoiceChallenge | VisualChallenge | MapChallenge;

/** Points à atteindre pour 1, 2 et 3 étoiles. */
export interface StarThresholds {
  one: number;
  two: number;
  three: number;
}

export interface Level {
  /** Identifiant stable : c'est lui qui relie les résultats enregistrés au niveau. */
  id: string;
  slug: string;
  nameKey: string;
  descriptionKey: string;
  stars: StarThresholds;
  /** Difficultés admises dans une partie de ce niveau, bornes comprises. */
  minDifficulty: QuestionDifficulty;
  maxDifficulty: QuestionDifficulty;
  /** Banque du niveau. Chaque partie y tire ses défis, voir question-selection.ts. */
  questions: LevelChallenge[];
}

export interface TerritoryPlace {
  id: string;
  nameKey: string;
  kind: "city" | "monument" | "village";
  /** Code de la subdivision de la région où se trouve le lieu. */
  subdivisionId: string;
}

/** Thèmes de l'album, communs à tous les pays. Leur libellé vient de l'interface. */
export type AlbumThemeId = "cities" | "gastronomy" | "heritage" | "traditions" | "crafts";

/** Ce qui donne une carte. Une carte méritée se déduit des résultats : voir album.ts. */
export interface CardUnlock {
  kind: "level-finished";
  levelId: string;
}

export interface SouvenirCard {
  /** Identifiant stable, unique dans tout le pays. */
  id: string;
  territoryId: string;
  themeId: AlbumThemeId;
  nameKey: string;
  descriptionKey: string;
  anecdoteKey: string;
  /** Photo créditée : son auteur et sa licence viennent des crédits du pays. */
  mediaId: string;
  unlock: CardUnlock;
}

/** `collector` : réunir des cartes. `master` : réussir le Défi Maître du territoire. */
export type RewardBadgeKind = "collector" | "master";

export interface RewardBadge {
  id: string;
  kind: RewardBadgeKind;
  territoryId: string;
  nameKey: string;
  descriptionKey: string;
  /** Liste figée : une carte ajoutée plus tard à la collection ne retire pas un badge déjà gagné. Vide pour `master`. */
  cardIds: string[];
}

/**
 * Territoire historique ou culturel, à l'intérieur d'une région administrative.
 * Ce n'est pas un découpage administratif : la région reste la seule entrée de la carte du pays.
 */
export interface Territory extends WithCover {
  id: string;
  /** Identique au nom du fichier du territoire. */
  slug: string;
  kind: "cultural";
  /** Région administrative qui donne accès à ce territoire. */
  regionId: string;
  nameKey: string;
  descriptionKey: string;
  /** Codes des subdivisions de la région qui composent ce territoire. */
  subdivisionIds: string[];
  places: TerritoryPlace[];
  mediaIds: string[];
  levels: Level[];
  souvenirCards: SouvenirCard[];
  badges: RewardBadge[];
  /** Un territoire publié a au moins un niveau jouable. */
  status: RegionStatus;
}

export type ContentMessages = Record<string, unknown>;

export interface CountryContent {
  country: CountryConfig;
  regions: Region[];
  map: CountryMap;
  territories: Territory[];
  gameMaps: GameMap[];
  credits: MediaCredit[];
  /** Textes propres au pays, par langue. */
  messages: Record<string, ContentMessages>;
}
