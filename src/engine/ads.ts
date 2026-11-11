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

/** Éditeur de démonstration de Google. */
export const ADMOB_DEMO_PUBLISHER = "ca-app-pub-3940256099942544";
/** Éditeur AdMob de JavaChrist (`pub-…` de `public/app-ads.txt`). */
export const ADMOB_JAVACHRIST_PUBLISHER = "ca-app-pub-8288172940135426";
/** Seuls éditeurs acceptés par `npm run check`, Gradle et le service AdMob. */
export const ADMOB_ALLOWED_PUBLISHERS = [ADMOB_DEMO_PUBLISHER, ADMOB_JAVACHRIST_PUBLISHER] as const;
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

const allowedId = (id: string, separator: "~" | "/"): boolean =>
  ADMOB_ALLOWED_PUBLISHERS.some((publisher) => id.startsWith(`${publisher}${separator}`) && /^\d+$/.test(id.slice(publisher.length + 1)));
export const isAllowedAndroidAppId = (id: string): boolean => allowedId(id, "~");
export const isAllowedAdUnit = (id: string): boolean => allowedId(id, "/");

/**
 * Annonces de test seulement, sauf en mode `live`. Même en `live`, les appareils de `testDevices`
 * restent déclarés comme appareils de test : jamais de clic réel depuis un téléphone de développement.
 */
export const adsTestMode = (ads: AdsConfig): boolean => ads.mode !== "live";

/** Configuration native lue dans `content/<pays>/android.json`, aussi par Gradle et Capacitor. */
export interface AndroidAppConfig {
  applicationId: string;
  appName: string;
  admobAppId: string;
}

/**
 * Contrôle de la configuration d'un pays : éditeur de démonstration ou éditeur JavaChrist seulement,
 * et mode `test` tant que Christian n'a pas validé les annonces réelles.
 */
export function adsConfigErrors(ads: AdsConfig | null, android: AndroidAppConfig | null, androidPackage: string, appName: string): string[] {
  const errors: string[] = [];
  if (android) {
    if (android.applicationId !== androidPackage) errors.push(`android.json applicationId (${android.applicationId}) différent de androidPackage (${androidPackage})`);
    if (android.appName !== appName) errors.push(`android.json appName (${android.appName}) différent de appName (${appName})`);
    if (!isAllowedAndroidAppId(android.admobAppId)) errors.push(`ID d'application AdMob non autorisé : ${android.admobAppId}`);
  }
  if (ads) {
    if (!android) errors.push("ads configuré sans content/<pays>/android.json");
    if (!isAllowedAdUnit(ads.admob.androidBannerAdUnitId)) errors.push(`Bloc de bannière non autorisé : ${ads.admob.androidBannerAdUnitId}`);
    if (ads.mode !== "test") errors.push(`Mode d'annonces « ${ads.mode} » non validé : seul « test » est accepté`);
    for (const device of ads.admob.testDevices) {
      if (!/^[0-9A-F]{32}$/.test(device)) errors.push(`Appareil de test invalide : ${device}`);
    }
    // Démo et JavaChrist ne se mélangent pas : un bloc ne sert que dans l'application de son éditeur.
    const publisher = (id: string) => id.split(/[~/]/)[0];
    if (android && publisher(android.admobAppId) !== publisher(ads.admob.androidBannerAdUnitId)) {
      errors.push("ID d'application et bloc de bannière de deux éditeurs différents");
    }
  }
  return errors;
}
