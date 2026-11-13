// Vérifie la bannière AdMob : configuration du pays, éditeurs autorisés, mode test ou live, droits, réglages selon l'âge.
// Usage : node scripts/check-ads.mjs [pays]
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  ADMOB_DEMO_ANDROID_APP_ID,
  ADMOB_DEMO_ANDROID_BANNER,
  ADMOB_JAVACHRIST_PUBLISHER,
  adAudience,
  adsAllowed,
  adsConfigErrors,
  adsTestMode,
  isAllowedAdUnit,
  isAllowedAndroidAppId,
  mayRequestBanner,
  requestSettingsFor,
} from "../src/engine/ads.ts";
import { computeEntitlements, effectiveEntitlements, FREE_ENTITLEMENTS } from "../src/engine/entitlements.ts";

const code = process.argv[2] ?? process.env.GEO_COUNTRY ?? "fr";
const { country } = await import(`../content/${code}/country.ts`);
const androidPath = new URL(`../content/${code}/android.json`, import.meta.url);
const android = existsSync(androidPath) ? JSON.parse(readFileSync(androidPath, "utf8")) : null;

// 1. Configuration du pays : éditeur de démonstration ou JavaChrist, live seulement avec JavaChrist, android.json cohérent avec country.ts.
const errors = adsConfigErrors(country.ads, android, country.androidPackage, country.appName);
assert.deepEqual(errors, [], `Configuration AdMob de ${code} :\n${errors.join("\n")}`);
// Annonces réelles validées par Christian le 13 novembre 2026 : `live` n'est accepté qu'avec le bloc JavaChrist.
if (country.ads && !adsTestMode(country.ads)) {
  assert.ok(country.ads.admob.androidBannerAdUnitId.startsWith(`${ADMOB_JAVACHRIST_PUBLISHER}/`), "live avec le bloc JavaChrist seulement");
}
assert.equal(ADMOB_DEMO_ANDROID_BANNER, "ca-app-pub-3940256099942544/9214589741");
assert.equal(ADMOB_DEMO_ANDROID_APP_ID, "ca-app-pub-3940256099942544~3347511713");
assert.equal(ADMOB_JAVACHRIST_PUBLISHER, "ca-app-pub-8288172940135426");
assert.ok(isAllowedAdUnit(ADMOB_DEMO_ANDROID_BANNER) && isAllowedAndroidAppId(ADMOB_DEMO_ANDROID_APP_ID));
assert.ok(isAllowedAdUnit(`${ADMOB_JAVACHRIST_PUBLISHER}/1`) && isAllowedAndroidAppId(`${ADMOB_JAVACHRIST_PUBLISHER}~1`));
assert.ok(!isAllowedAdUnit("ca-app-pub-1234567890123456/1234567890"));
assert.ok(!isAllowedAdUnit(`${ADMOB_JAVACHRIST_PUBLISHER}~1`), "un ID d'application n'est pas un bloc");
assert.ok(!isAllowedAndroidAppId(`${ADMOB_JAVACHRIST_PUBLISHER}0~1`), "préfixe d'un autre éditeur");
const demoAds = { mode: "test", admob: { androidBannerAdUnitId: ADMOB_DEMO_ANDROID_BANNER, testDevices: [] } };
const demoAndroid = { ...android, admobAppId: ADMOB_DEMO_ANDROID_APP_ID };
assert.deepEqual(adsConfigErrors(demoAds, demoAndroid, country.androidPackage, country.appName), []);
assert.equal(
  adsConfigErrors({ ...demoAds, admob: { ...demoAds.admob, androidBannerAdUnitId: "ca-app-pub-1234567890123456/1" } }, { ...android, admobAppId: "ca-app-pub-1234567890123456~1" }, country.androidPackage, country.appName).length,
  2,
);
assert.equal(adsConfigErrors({ ...demoAds, mode: "live" }, demoAndroid, country.androidPackage, country.appName).length, 1, "live refusé avec le bloc de démonstration");
assert.equal(adsConfigErrors({ ...demoAds, mode: "other" }, demoAndroid, country.androidPackage, country.appName).length, 1, "mode inconnu refusé");
const javaChristAds = { mode: "live", admob: { androidBannerAdUnitId: `${ADMOB_JAVACHRIST_PUBLISHER}/1`, testDevices: [] } };
const javaChristAndroid = { ...android, admobAppId: `${ADMOB_JAVACHRIST_PUBLISHER}~1` };
assert.deepEqual(adsConfigErrors(javaChristAds, javaChristAndroid, country.androidPackage, country.appName), [], "live accepté avec le bloc JavaChrist");
assert.equal(adsConfigErrors({ ...demoAds, admob: { ...demoAds.admob, testDevices: ["abc"] } }, demoAndroid, country.androidPackage, country.appName).length, 1);
assert.equal(adsConfigErrors(demoAds, { ...android, admobAppId: `${ADMOB_JAVACHRIST_PUBLISHER}~1` }, country.androidPackage, country.appName).length, 1, "éditeurs mélangés");
assert.equal(adsConfigErrors(demoAds, null, "x", "y").length, 1);
assert.equal(adsTestMode({ ...demoAds, mode: "live" }), false);

// 2. Gradle doit refuser tout autre éditeur.
const gradle = readFileSync(new URL("../android/app/build.gradle", import.meta.url), "utf8");
assert.ok(
  gradle.includes("admobAppId ==~ /(ca-app-pub-3940256099942544|ca-app-pub-8288172940135426)~\\d+/"),
  "android/app/build.gradle doit refuser un ID AdMob d'un autre éditeur",
);
// Un build release sans serveur (canal off : ni compte ni Boutique) est refusé par Gradle.
assert.ok(
  gradle.includes("task.name == 'preReleaseBuild'") && gradle.includes("geo-export.json") && gradle.includes("payments != 'play'"),
  "android/app/build.gradle doit refuser un build release exporté sans NEXT_PUBLIC_API_BASE_URL",
);
assert.ok(
  readFileSync(new URL("./build-export.mjs", import.meta.url), "utf8").includes('writeFileSync("out/geo-export.json"'),
  "scripts/build-export.mjs doit écrire le marqueur du canal de paiement",
);
// Aucun identifiant publicitaire ni Privacy Sandbox dans le manifeste fusionné : les permissions du SDK sont retirées.
const manifest = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
for (const permission of [
  "com.google.android.gms.permission.AD_ID",
  "android.permission.ACCESS_ADSERVICES_AD_ID",
  "android.permission.ACCESS_ADSERVICES_TOPICS",
  "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
]) {
  assert.ok(manifest.includes(`<uses-permission android:name="${permission}" tools:node="remove" />`), `${permission} doit être retirée`);
}

// 3. app-ads.txt, à la racine du site web, autorise l'éditeur JavaChrist.
const appAds = readFileSync(new URL("../public/app-ads.txt", import.meta.url), "utf8");
assert.match(appAds, new RegExp(`^google\\.com, ${ADMOB_JAVACHRIST_PUBLISHER.replace("ca-app-", "")}, DIRECT, f08c47fec0942fa0$`, "m"));
const variables = readFileSync(new URL("../android/variables.gradle", import.meta.url), "utf8");
const sdk = variables.match(/playServicesAdsVersion = '([^']+)'/)?.[1];
assert.ok(sdk && /^\d+\.\d+\.\d+$/.test(sdk), "playServicesAdsVersion doit être une version exacte");
assert.ok(Number(sdk.split(".")[0]) >= 19, "Google Mobile Ads est autocertifié Families à partir de 19.0.0");
assert.match(variables, /userMessagingPlatformVersion = '\d+\.\d+\.\d+'/, "userMessagingPlatformVersion doit être une version exacte");

// 4. Droits : aucune annonce dans le doute.
const base = { configured: true, native: true, entitlementsReady: true, adsRemoved: false, granted: false, forceNoAds: false };
assert.equal(adsAllowed(base), true);
for (const key of ["configured", "native", "entitlementsReady"]) assert.equal(adsAllowed({ ...base, [key]: false }), false, key);
for (const key of ["adsRemoved", "granted", "forceNoAds"]) assert.equal(adsAllowed({ ...base, [key]: true }), false, key);

// 5. Âge : seul « adulte » ouvre UMP ; mineur et inconnu sont protégés.
assert.equal(adAudience("adult"), "adult");
assert.equal(adAudience("minor"), "restricted");
assert.equal(adAudience(null), "restricted");
// Mode Famille (appareil partagé) : jamais de réglage adulte, même après « 18 ans ou plus ».
assert.equal(adAudience("adult", true), "restricted");
assert.equal(adAudience("minor", true), "restricted");
assert.equal(adAudience(null, true), "restricted");
const restricted = requestSettingsFor("restricted");
assert.deepEqual(restricted, { tagForChildDirectedTreatment: true, tagForUnderAgeOfConsent: true, maxAdContentRating: "General", nonPersonalized: true, consent: "skip" });
const adult = requestSettingsFor("adult");
assert.equal(adult.maxAdContentRating, "General");
assert.equal(adult.consent, "ump");

// 6. Une requête ne part qu'avec les réglages appliqués et, pour un adulte, le consentement.
assert.equal(mayRequestBanner({ allowed: true, settingsApplied: "restricted", audience: "restricted", consent: null }), true);
assert.equal(mayRequestBanner({ allowed: true, settingsApplied: null, audience: "restricted", consent: null }), false);
assert.equal(mayRequestBanner({ allowed: true, settingsApplied: "adult", audience: "restricted", consent: null }), false);
assert.equal(mayRequestBanner({ allowed: false, settingsApplied: "restricted", audience: "restricted", consent: null }), false);
assert.equal(mayRequestBanner({ allowed: true, settingsApplied: "adult", audience: "adult", consent: null }), false);
assert.equal(mayRequestBanner({ allowed: true, settingsApplied: "adult", audience: "adult", consent: { canRequestAds: false } }), false);
assert.equal(mayRequestBanner({ allowed: true, settingsApplied: "adult", audience: "adult", consent: { canRequestAds: true } }), true);

// 7. Droits réels, du calcul des commandes jusqu'à la décision : Solo sans pub, Famille sans pub et accès offert
// n'ont jamais d'annonce, même un remboursement d'une autre commande ne les rouvre pas. Le build de test seul ne suffit pas.
const { editions } = await import(`../content/${code}/editions.ts`);
const access = (entitlements, ready = true) =>
  adsAllowed({ ...base, entitlementsReady: ready, adsRemoved: entitlements.adsRemoved, granted: entitlements.granted });
const paid = (editionId, status = "paid") => ({ editionId, status });
const rights = (orders, granted = false) => effectiveEntitlements(computeEntitlements(orders, editions), granted);
assert.equal(access(FREE_ENTITLEMENTS), true, "version gratuite sans compte : bannière permise");
assert.equal(access(rights([paid("solo_ads")])), true, "Solo avec publicités");
assert.equal(access(rights([paid("family_ads")])), true, "Famille avec publicités");
assert.equal(access(rights([paid("solo_no_ads")])), false, "Solo sans publicités");
assert.equal(access(rights([paid("family_no_ads")])), false, "Famille sans publicités");
assert.equal(access(rights([], true)), false, "accès offert");
assert.equal(access(rights([paid("solo_ads")], true)), false, "accès offert sur une édition avec publicités");
assert.equal(access(rights([paid("solo_no_ads"), paid("family_ads", "refunded")])), false, "remboursement d'une autre commande");
assert.equal(access(rights([paid("solo_no_ads", "refunded")])), true, "Solo sans pub remboursé : droits retirés");
for (const status of ["pending", "open", "authorized", "created"]) {
  assert.equal(access(rights([paid("family_no_ads", status)])), true, `commande ${status} : pas encore de droit`);
}
for (const [label, entitlements] of [["Solo sans pub", rights([paid("solo_no_ads")])], ["accès offert", rights([], true)]]) {
  assert.equal(access(entitlements, false), false, `${label} : droits en chargement`);
}

// 8. Le fournisseur de bannière lit les droits réels et refuse les droits illisibles (« offline ») ; lui seul demande une annonce.
const provider = readFileSync(new URL("../src/features/ads/AdsProvider.tsx", import.meta.url), "utf8");
assert.match(provider, /adsRemoved: entitlements\.adsRemoved/, "AdsProvider doit lire entitlements.adsRemoved");
assert.match(provider, /granted: entitlements\.granted/, "AdsProvider doit lire entitlements.granted");
assert.match(provider, /entitlementsReady: status === "ready"/, "AdsProvider : aucune annonce tant que les droits ne sont pas prêts");
const family = readFileSync(new URL("../src/features/family/FamilyMode.tsx", import.meta.url), "utf8");
assert.match(family, /useRestrictedAdAudience\(true\)/, "Mode Famille : public restreint pendant tout le mode");
assert.match(provider, /adAudience\(adult, restrictCount > 0\)/, "AdsProvider doit appliquer la restriction du mode Famille");
const { readdirSync, statSync } = await import("node:fs");
const callers = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(name) && /\b(showBanner|applyRequestSettings|gatherConsent|resumeBanner)\b|@capacitor-community\/admob/.test(readFileSync(path, "utf8"))) callers.push(path);
  }
};
walk(new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const relative = callers.map((path) => path.replace(/^.*\/src\//, "src/")).sort();
assert.deepEqual(relative, ["src/features/ads/AdsProvider.tsx", "src/services/ads/admob.ts"], `Seul AdsProvider demande une annonce : ${relative.join(", ")}`);

console.log(`Annonces ${code} : configuration, droits et réglages selon l'âge vérifiés.`);
