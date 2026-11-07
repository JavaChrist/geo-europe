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

/**
 * Lien avec JavaChrist-Legal-Kit, seule source des documents juridiques (voir `docs/juridique.md`).
 * L'éditeur, l'hébergeur, le médiateur et la TVA sont décrits dans le kit, jamais ici.
 */
export interface LegalConfig {
  /** Identifiant de l'application dans le kit : `apps/<kitAppId>.json`. */
  kitAppId: string;
  /** Contact cité dans les rubriques locales. Identique au `supportEmail` de la configuration du kit. */
  supportEmail: string;
}

export interface CountryConfig {
  /** Code du dossier de contenu, identique à GEO_COUNTRY. */
  code: string;
  appName: string;
  androidPackage: string;
  locales: string[];
  defaultLocale: string;
  regionCount: number;
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
  /** Illustration créditée du badge. Sans elle, le badge affiche son icône. */
  mediaId?: string;
}

/**
 * Parcours d'une région administrative. « cultural » : territoire historique ou culturel, à l'intérieur de la région,
 * qui peut en compter plusieurs. « administrative » : la région entière, seule de sa région, dont le parcours s'ouvre directement.
 * Dans tous les cas, la région reste la seule entrée de la carte du pays.
 */
export interface Territory extends WithCover {
  id: string;
  /** Identique au nom du fichier du territoire. */
  slug: string;
  kind: "cultural" | "administrative";
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
  /** Bonnes réponses à obtenir au Défi Maître, si le territoire s'écarte de la règle commune. */
  masterPassCorrect?: number;
  /** Un territoire publié a au moins un niveau jouable. */
  status: RegionStatus;
}

/** Thème du Mode Famille déclaré par un pays : un libellé de contenu et les catégories de questions qu'il regroupe. */
export interface FamilyTheme {
  id: string;
  nameKey: string;
  categories: string[];
}

/** Réglages du Mode Famille propres au pays. */
export interface FamilyContent {
  themes: FamilyTheme[];
}

export type ContentMessages = Record<string, unknown>;

/**
 * Éditions commerciales d'un pays : seule source des tarifs (voir `docs/editions.md`).
 * Les identifiants sont communs à la collection, les prix sont propres au pays.
 */
export type EditionId = "discovery" | "solo_ads" | "solo_no_ads" | "family_ads" | "family_no_ads";

export interface Edition {
  id: EditionId;
  mode: "discovery" | "solo" | "family";
  /** Avec publicités. `null` : pas encore décidé. */
  ads: boolean | null;
  /** Prix TTC en centimes. 0 pour l'édition gratuite. */
  priceCents: number;
  /** Achat unique, jamais d'abonnement. */
  purchase: "free" | "one_time";
  /** Nombre de régions incluses, ou toutes. */
  regions: number | "all";
  /** `planned` tant que l'édition n'est pas réellement en vente. */
  status: "planned" | "active";
}

export interface EditionsConfig {
  currency: string;
  /** Canaux de vente prévus, repris dans le catalogue du Legal Kit. */
  channel: string;
  editions: Edition[];
}

export interface CountryContent {
  country: CountryConfig;
  editions: EditionsConfig;
  regions: Region[];
  map: CountryMap;
  territories: Territory[];
  gameMaps: GameMap[];
  credits: MediaCredit[];
  family: FamilyContent;
  /** Textes propres au pays, par langue. */
  messages: Record<string, ContentMessages>;
}
