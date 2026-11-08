/**
 * Promotions JavaChrist : vidéos courtes vers les autres applications de JavaChrist, lues dans le catalogue public
 * du gestionnaire JavaChrist-Promotions (voir `docs/promotions.md`). Aucune dépendance à React, Next ou Firebase.
 */
import type { PromotionsConfig } from "./types.ts";

export type { PromotionsConfig };

/** Campagne publiée, déjà contrôlée. */
export interface PromoCampaign {
  id: string;
  /** Nom de l'application promue. */
  name: string;
  videoUrl: string;
  durationMs: number;
  /** Fiche Google Play de l'application promue. */
  destinationUrl: string;
  weight: number;
  startsAt: string | null;
  endsAt: string | null;
}

export const PROMO_RULES = {
  /** Parties terminées (niveaux, défis spéciaux, parties familiales) entre deux promotions. */
  gamesBetween: 3,
  /** Durée maximale d'une vidéo, et d'une lecture. */
  maxDurationMs: 15_000,
  /** Le catalogue est relu au plus une fois par période. */
  catalogTtlMs: 15 * 60_000,
  /** Copie encore utilisée quand le réseau échoue, jusqu'à cet âge. */
  catalogStaleMaxMs: 60 * 60_000,
  fetchTimeoutMs: 3_000,
  /** Sans image après ce délai, la vidéo est considérée comme bloquée et la fermeture apparaît. */
  stallMs: 6_000,
  /** Fermeture toujours possible après ce délai, quoi qu'il arrive. */
  hardLimitMs: 20_000,
  /** Pause laissée sur l'écran de résultat avant la vidéo. */
  resultDelayMs: 1_500,
  audience: "adult",
  destinationHost: "play.google.com",
} as const;

// --- Valeurs de l'API REST Firestore ---

/** Valeur typée renvoyée par l'API REST Firestore (`stringValue`, `integerValue`, `mapValue`…). */
export type FirestoreValue = Record<string, unknown>;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Convertit une valeur REST Firestore en valeur JavaScript. Les types inconnus deviennent `undefined`. */
export function fromFirestoreValue(value: unknown): unknown {
  if (!isObject(value)) return undefined;
  if ("nullValue" in value) return null;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.booleanValue === "boolean") return value.booleanValue;
  if ("integerValue" in value) {
    const number = Number(value.integerValue);
    return Number.isSafeInteger(number) ? number : undefined;
  }
  if ("doubleValue" in value) {
    const number = Number(value.doubleValue);
    return Number.isFinite(number) ? number : undefined;
  }
  if (typeof value.timestampValue === "string") return value.timestampValue;
  if (isObject(value.arrayValue)) {
    const values = value.arrayValue.values;
    return Array.isArray(values) ? values.map(fromFirestoreValue) : [];
  }
  if (isObject(value.mapValue)) return fromFirestoreFields(value.mapValue.fields);
  return undefined;
}

/** Convertit les `fields` d'un document ou d'une carte REST Firestore. */
export function fromFirestoreFields(fields: unknown): Record<string, unknown> {
  if (!isObject(fields)) return {};
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

// --- Contrôle des campagnes ---

const httpsUrl = (value: unknown, host?: string): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (host === undefined || url.hostname === host);
  } catch {
    return false;
  }
};

const isDate = (value: unknown): value is string | null => value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));

/**
 * Garde une campagne du catalogue seulement si elle est complète, pour adultes, dans la langue du pays,
 * en HTTPS, vers Google Play, d'une durée de 15 s au plus et dans sa période de diffusion.
 */
export function campaignFrom(raw: unknown, locale: string, now: Date): PromoCampaign | null {
  if (!isObject(raw)) return null;
  const { id, name, audience, videoUrl, durationMs, destinationUrl, weight } = raw;
  const startsAt = raw.startsAt ?? null;
  const endsAt = raw.endsAt ?? null;
  if (typeof id !== "string" || id === "" || typeof name !== "string" || name.trim() === "") return null;
  if (audience !== PROMO_RULES.audience || raw.locale !== locale) return null;
  if (!httpsUrl(videoUrl) || !httpsUrl(destinationUrl, PROMO_RULES.destinationHost)) return null;
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > PROMO_RULES.maxDurationMs) return null;
  if (!isDate(startsAt) || !isDate(endsAt)) return null;
  const time = now.getTime();
  if (startsAt !== null && Date.parse(startsAt) > time) return null;
  if (endsAt !== null && Date.parse(endsAt) <= time) return null;
  return {
    id,
    name: name.trim(),
    videoUrl,
    durationMs,
    destinationUrl,
    weight: Math.max(1, Math.round(typeof weight === "number" && Number.isFinite(weight) ? weight : 1)),
    startsAt,
    endsAt,
  };
}

/** Campagnes valables d'un document `public_catalogs/<id>` lu en REST. Un document illisible donne une liste vide. */
export function campaignsFromCatalogDocument(document: unknown, locale: string, now: Date): PromoCampaign[] {
  if (!isObject(document)) return [];
  const campaigns = fromFirestoreFields(document.fields).campaigns;
  if (!Array.isArray(campaigns)) return [];
  const seen = new Set<string>();
  const valid: PromoCampaign[] = [];
  for (const raw of campaigns) {
    const campaign = campaignFrom(raw, locale, now);
    if (campaign && !seen.has(campaign.id)) {
      seen.add(campaign.id);
      valid.push(campaign);
    }
  }
  return valid;
}

/** Recontrôle une liste en cache : une campagne peut être arrivée au bout de sa période depuis la lecture. */
export function stillValid(campaigns: readonly unknown[], locale: string, now: Date): PromoCampaign[] {
  return campaigns
    .map((campaign) => campaignFrom(isObject(campaign) ? { ...campaign, audience: PROMO_RULES.audience, locale } : campaign, locale, now))
    .filter((campaign): campaign is PromoCampaign => campaign !== null);
}

/**
 * Tirage pondéré. La dernière vidéo vue est écartée quand une autre est disponible,
 * pour ne jamais la rejouer deux fois de suite.
 */
export function pickCampaign(campaigns: readonly PromoCampaign[], lastShownId: string | null, random: () => number): PromoCampaign | null {
  const others = campaigns.filter((campaign) => campaign.id !== lastShownId);
  const pool = others.length > 0 ? others : campaigns;
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, campaign) => sum + campaign.weight, 0);
  let draw = random() * total;
  for (const campaign of pool) {
    draw -= campaign.weight;
    if (draw < 0) return campaign;
  }
  return pool[pool.length - 1] ?? null;
}

// --- Fréquence ---

/** Réponse à la question d'âge, enregistrée seulement sur l'appareil. */
export type AdultAnswer = "adult" | "minor" | null;

export interface PromoState {
  /** Parties terminées depuis la dernière promotion vue. */
  completedSinceLast: number;
  lastShownId: string | null;
  adult: AdultAnswer;
}

export const INITIAL_PROMO_STATE: PromoState = { completedSinceLast: 0, lastShownId: null, adult: null };

/**
 * Une partie terminée : niveau, défi spécial ou partie familiale entière.
 * Une question, un abandon ou un rechargement n'appellent jamais cette fonction.
 */
export function afterGameCompleted(state: PromoState): PromoState {
  return { ...state, completedSinceLast: Math.min(state.completedSinceLast + 1, PROMO_RULES.gamesBetween) };
}

/** Le compteur repart de zéro seulement quand une vidéo a réellement été montrée. */
export function afterPromoShown(state: PromoState, campaignId: string): PromoState {
  return { ...state, completedSinceLast: 0, lastShownId: campaignId };
}

export function isPromoDue(state: PromoState): boolean {
  return state.completedSinceLast >= PROMO_RULES.gamesBetween;
}

export interface PromoAccess {
  /** Pays raccordé au gestionnaire de promotions. */
  configured: boolean;
  /** Droits lus : tant qu'ils chargent, rien n'est décidé. */
  entitlementsReady: boolean;
  /** Édition sans publicités : ni vidéo ni requête. */
  adsRemoved: boolean;
}

/** Promotions possibles pour cet appareil, avant la question d'âge. */
export function promotionsAllowed(access: PromoAccess): boolean {
  return access.configured && access.entitlementsReady && !access.adsRemoved;
}

/**
 * Le catalogue ne peut être lu que pour un adulte déclaré, sur une édition avec publicités.
 * Âge inconnu ou mineur : aucune requête.
 */
export function mayFetchCatalog(access: PromoAccess, state: PromoState): boolean {
  return promotionsAllowed(access) && state.adult === "adult";
}

/** Adresse REST du catalogue public d'un jeu. */
export function catalogUrl(config: PromotionsConfig): string {
  const project = encodeURIComponent(config.catalogProjectId);
  const source = encodeURIComponent(config.sourceAppId);
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/public_catalogs/${source}`;
}

/** Erreurs de configuration, contrôlées par `npm run check`. */
export function promotionsConfigErrors(config: PromotionsConfig | null): string[] {
  if (config === null) return [];
  const errors: string[] = [];
  if (!/^[a-z0-9-]+$/.test(config.sourceAppId)) errors.push(`sourceAppId invalide : ${config.sourceAppId}`);
  if (!/^[a-z0-9-]+$/.test(config.catalogProjectId)) errors.push(`catalogProjectId invalide : ${config.catalogProjectId}`);
  if (!/^[a-z]{2}$/.test(config.locale)) errors.push(`locale invalide : ${config.locale}`);
  return errors;
}
