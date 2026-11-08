import {
  afterGameCompleted,
  afterPromoShown,
  campaignsFromCatalogDocument,
  catalogUrl,
  INITIAL_PROMO_STATE,
  PROMO_RULES,
  stillValid,
  type AdultAnswer,
  type PromoCampaign,
  type PromoState,
  type PromotionsConfig,
} from "@/engine/promotions";

/**
 * État des promotions sur l'appareil : compteur de parties, dernière vidéo vue, réponse à la question d'âge,
 * et copie du catalogue. Rien n'est envoyé : le catalogue est seulement lu, sans compte ni identifiant.
 * Une écriture refusée par le navigateur n'est pas une erreur pour le joueur : la promotion attend, c'est tout.
 */
const FORMAT_VERSION = 1;

interface CachedCatalog {
  fetchedAt: number;
  campaigns: PromoCampaign[];
}

interface StoredPromotions {
  version: number;
  state: PromoState;
  catalog: CachedCatalog | null;
}

const storageKey = (countryCode: string) => `geo-europe.${countryCode}.promotions`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isAdult = (value: unknown): value is AdultAnswer => value === "adult" || value === "minor" || value === null;

function parseState(value: unknown): PromoState {
  if (!isObject(value)) return INITIAL_PROMO_STATE;
  const count = value.completedSinceLast;
  return {
    completedSinceLast:
      typeof count === "number" && Number.isInteger(count) && count >= 0 ? Math.min(count, PROMO_RULES.gamesBetween) : 0,
    lastShownId: typeof value.lastShownId === "string" ? value.lastShownId : null,
    adult: isAdult(value.adult) ? value.adult : null,
  };
}

function parseCatalog(value: unknown): CachedCatalog | null {
  if (!isObject(value) || typeof value.fetchedAt !== "number" || !Array.isArray(value.campaigns)) return null;
  return { fetchedAt: value.fetchedAt, campaigns: value.campaigns as PromoCampaign[] };
}

function read(countryCode: string): StoredPromotions {
  try {
    const raw = window.localStorage.getItem(storageKey(countryCode));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(parsed) || parsed.version !== FORMAT_VERSION) return { version: FORMAT_VERSION, state: INITIAL_PROMO_STATE, catalog: null };
    return { version: FORMAT_VERSION, state: parseState(parsed.state), catalog: parseCatalog(parsed.catalog) };
  } catch {
    return { version: FORMAT_VERSION, state: INITIAL_PROMO_STATE, catalog: null };
  }
}

function write(countryCode: string, stored: StoredPromotions): void {
  try {
    window.localStorage.setItem(storageKey(countryCode), JSON.stringify(stored));
  } catch {
    // Stockage plein ou bloqué : la promotion ne s'affiche pas, la partie continue.
  }
}

const update = (countryCode: string, change: (state: PromoState) => PromoState): PromoState => {
  const stored = read(countryCode);
  const state = change(stored.state);
  write(countryCode, { ...stored, state });
  return state;
};

export const readPromoState = (countryCode: string): PromoState => read(countryCode).state;

/** À appeler une seule fois par partie réellement terminée. */
export const recordGameCompleted = (countryCode: string): PromoState => update(countryCode, afterGameCompleted);

export const recordPromoShown = (countryCode: string, campaignId: string): PromoState =>
  update(countryCode, (state) => afterPromoShown(state, campaignId));

/** Réponse à la question d'âge. Un mineur n'a plus de catalogue en cache. */
export function recordAdultAnswer(countryCode: string, adult: AdultAnswer): void {
  const stored = read(countryCode);
  write(countryCode, { ...stored, state: { ...stored.state, adult }, catalog: adult === "adult" ? stored.catalog : null });
}

/** Vrai si l'appareil garde quelque chose des promotions (compteur, réponse d'âge, dernière vidéo). */
export function hasPromotionsData(countryCode: string): boolean {
  const { state } = read(countryCode);
  return state.completedSinceLast > 0 || state.lastShownId !== null || state.adult !== null;
}

/** Efface tout : compteur, réponse à la question d'âge et catalogue. */
export function clearPromotions(countryCode: string): void {
  try {
    window.localStorage.removeItem(storageKey(countryCode));
  } catch {
    // Rien à effacer si le stockage est inaccessible.
  }
}

async function fetchCatalog(config: PromotionsConfig): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROMO_RULES.fetchTimeoutMs);
  try {
    // Lecture publique, sans clé ni jeton : le catalogue ne contient que des campagnes publiées.
    const response = await fetch(catalogUrl(config), {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    // Catalogue pas encore créé dans le gestionnaire : aucune campagne.
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`catalogue ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Campagnes diffusables. La copie locale sert pendant 15 minutes ; ensuite le catalogue est relu,
 * et en cas d'échec réseau la copie sert encore jusqu'à une heure. Au-delà, aucune campagne.
 * À n'appeler qu'après `mayFetchCatalog` : jamais pour une édition sans publicités ni sans réponse « adulte ».
 */
export async function loadCampaigns(countryCode: string, config: PromotionsConfig, now = Date.now()): Promise<PromoCampaign[]> {
  const stored = read(countryCode);
  const cached = stored.catalog;
  const age = cached ? now - cached.fetchedAt : Number.POSITIVE_INFINITY;
  if (cached && age >= 0 && age < PROMO_RULES.catalogTtlMs) return stillValid(cached.campaigns, config.locale, new Date(now));
  try {
    const document = await fetchCatalog(config);
    const campaigns = campaignsFromCatalogDocument(document, config.locale, new Date(now));
    // Relu au moment d'écrire : la réponse à la question d'âge a pu changer pendant la requête.
    const latest = read(countryCode);
    if (latest.state.adult === "adult") write(countryCode, { ...latest, catalog: { fetchedAt: now, campaigns } });
    return campaigns;
  } catch {
    if (cached && age >= 0 && age < PROMO_RULES.catalogStaleMaxMs) return stillValid(cached.campaigns, config.locale, new Date(now));
    return [];
  }
}
