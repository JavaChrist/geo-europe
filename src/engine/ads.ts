import type { AdultAnswer } from "./promotions.ts";
import type { AdsConfig } from "./types.ts";

export type { AdsConfig };

/**
 * Bannière Google AdMob de l'application Android (voir `docs/admob.md`). Sans React, Capacitor ni AdMob :
 * ce module décide seulement si une annonce peut être demandée, et avec quels réglages.
 *
 * Deux publics :
 * - `adult` : l'appareil a répondu « 18 ans ou plus » à la question neutre existante (promotions). Consentement UMP.
 * - `restricted` : mineur ou âge inconnu. Protections Google Play Families : annonces destinées aux enfants,
 *   non personnalisées, classification G, aucun identifiant publicitaire transmis. Aucun formulaire UMP.
 */

/** Éditeur de démonstration de Google : le seul accepté tant que Christian n'a pas validé les annonces réelles. */
export const ADMOB_DEMO_PUBLISHER = "ca-app-pub-3940256099942544";
/** ID d'application Android de démonstration. */
export const ADMOB_DEMO_ANDROID_APP_ID = `${ADMOB_DEMO_PUBLISHER}~3347511713`;
/** Bloc de bannière adaptative fixe de démonstration, Android. */
export const ADMOB_DEMO_ANDROID_BANNER = `${ADMOB_DEMO_PUBLISHER}/9214589741`;

export const ADS_RULES = {
  /** Après un échec de chargement, nouvel essai au plus tôt après ce délai. */
  retryAfterMs: 60_000,
} as const;

export type AdAudience = "adult" | "restricted";

/** Seule une réponse « adulte » explicite ouvre le consentement UMP. Mineur, « plus tard » ou effacé : restreint. */
export const adAudience = (adult: AdultAnswer): AdAudience => (adult === "adult" ? "adult" : "restricted");

/** Réglages appliqués au SDK avant toute requête (`MobileAds.setRequestConfiguration`). */
export interface AdRequestSettings {
  tagForChildDirectedTreatment: boolean;
  tagForUnderAgeOfConsent: boolean;
  /** Classification maximale : G pour tous les publics, le jeu s'adresse aussi aux enfants. */
  maxAdContentRating: "General";
  /** Annonces non personnalisées demandées explicitement (`npa=1`). */
  nonPersonalized: boolean;
  /** `ump` : formulaire de consentement Google ; `skip` : aucun appel UMP. */
  consent: "ump" | "skip";
}

export function requestSettingsFor(audience: AdAudience): AdRequestSettings {
  if (audience === "adult") {
    // La personnalisation dépend alors du seul choix fait dans le formulaire UMP (chaîne TCF lue par le SDK).
    return { tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false, maxAdContentRating: "General", nonPersonalized: false, consent: "ump" };
  }
  // TFCD et TFUA empêchent la transmission de l'identifiant publicitaire Android et la publicité personnalisée.
  return { tagForChildDirectedTreatment: true, tagForUnderAgeOfConsent: true, maxAdContentRating: "General", nonPersonalized: true, consent: "skip" };
}

export interface AdsAccess {
  /** Le pays a une configuration AdMob valide. */
  configured: boolean;
  /** Application Android (Capacitor). Jamais d'AdMob sur le web. */
  native: boolean;
  /** Droits connus : aucune requête tant qu'ils se chargent. */
  entitlementsReady: boolean;
  adsRemoved: boolean;
  /** Accès offert : toujours sans publicité, même si `adsRemoved` manquait. */
  granted: boolean;
  /** Option de build réservée aux tests (`NEXT_PUBLIC_ADS_TEST_NO_ADS=1`) : ne peut que retirer les annonces. */
  forceNoAds: boolean;
}

/** Vrai seulement si une annonce peut être demandée pour ce joueur. Dans le doute, aucune annonce. */
export const adsAllowed = (access: AdsAccess): boolean =>
  access.configured && access.native && access.entitlementsReady && !access.adsRemoved && !access.granted && !access.forceNoAds;

/** Réponse du consentement UMP, pour un adulte. */
export interface ConsentResult {
  canRequestAds: boolean;
}

/**
 * Une annonce ne part que si tout est réuni : droits, réglages d'âge appliqués avec succès au SDK,
 * consentement UMP accordé pour un adulte. Toute étape qui échoue coupe la bannière.
 */
export function mayRequestBanner(input: {
  allowed: boolean;
  settingsApplied: AdAudience | null;
  audience: AdAudience;
  consent: ConsentResult | null;
}): boolean {
  if (!input.allowed || input.settingsApplied !== input.audience) return false;
  if (requestSettingsFor(input.audience).consent === "skip") return true;
  return input.consent?.canRequestAds === true;
}

export const isDemoAndroidAppId = (id: string): boolean => id === ADMOB_DEMO_ANDROID_APP_ID;
export const isDemoAdUnit = (id: string): boolean => id.startsWith(`${ADMOB_DEMO_PUBLISHER}/`);

/** Configuration native lue dans `content/<pays>/android.json`, aussi par Gradle et Capacitor. */
export interface AndroidAppConfig {
  applicationId: string;
  appName: string;
  admobAppId: string;
}

/**
 * Contrôle de la configuration d'un pays. Tant que les annonces réelles ne sont pas validées,
 * seuls les identifiants de démonstration de Google sont acceptés.
 */
export function adsConfigErrors(ads: AdsConfig | null, android: AndroidAppConfig | null, androidPackage: string, appName: string): string[] {
  const errors: string[] = [];
  if (android) {
    if (android.applicationId !== androidPackage) errors.push(`android.json applicationId (${android.applicationId}) différent de androidPackage (${androidPackage})`);
    if (android.appName !== appName) errors.push(`android.json appName (${android.appName}) différent de appName (${appName})`);
    if (!isDemoAndroidAppId(android.admobAppId)) errors.push(`ID d'application AdMob non autorisé : ${android.admobAppId}`);
  }
  if (ads) {
    if (!android) errors.push("ads configuré sans content/<pays>/android.json");
    if (!isDemoAdUnit(ads.admob.androidBannerAdUnitId)) errors.push(`Bloc de bannière non autorisé : ${ads.admob.androidBannerAdUnitId}`);
  }
  return errors;
}
