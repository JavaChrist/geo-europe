# Annonces Google AdMob (application Android)

Bannière AdMob des éditions avec publicités, dans l'application Android Capacitor. Le même code sert à GéoDE, GéoES et GéoIT : seule la configuration de `content/<pays>/` change.

État : **vrais identifiants AdMob JavaChrist, annonces réelles** (`ads.mode: "live"`, validé par Christian le 13 novembre 2026, à partir du versionCode 12). Le téléphone de test déclaré dans `testDevices` reçoit toujours des annonces de test. Aucune publication Google Play sans la validation de Christian.

## Ce qui est affiché

| Élément | Règle |
| --- | --- |
| Bannière adaptative | En bas de l'écran, juste au-dessus de la barre de navigation à 5 boutons. Sur grand écran, où la barre est masquée, en bas de l'écran |
| Contenu | La page réserve la hauteur de la bannière (`--ad-banner-h`) : réponses, cartes et boutons ne sont jamais recouverts |
| Pendant une partie | Bannière masquée (`usePromotion(playing)` appelle `useHideAdBanner`, `PromotionProvider` fait de même pendant la question d'âge et la vidéo) |
| Modale, question d'âge, vidéo de promotion | Bannière masquée : c'est une vue native, elle passerait au-dessus de la WebView |
| Interstitiel, vidéo récompensée | Jamais |
| Vidéos JavaChrist-Promotions | Indépendantes : leur fréquence, leur catalogue et leur lecteur ne changent pas |
| Web | Jamais d'AdMob : le module n'est chargé que dans l'application native |

## Qui voit une annonce

Décision dans `src/engine/ads.ts` (`adsAllowed`), lue par `src/features/ads/AdsProvider.tsx`. Aucune requête AdMob si l'une de ces conditions est vraie :

- le pays a `ads: null` ;
- ce n'est pas l'application native ;
- les droits sont en cours de chargement (`useEntitlements().status === "loading"`) ;
- `entitlements.adsRemoved` (Solo ou Famille sans publicités) ;
- `entitlements.granted` (accès offert, toujours sans publicité) ;
- le build de test `NEXT_PUBLIC_ADS_TEST_NO_ADS=1`. Cette option ne peut que retirer les annonces, jamais ouvrir un droit.

Si les droits passent à « sans publicité » pendant que l'application tourne, la bannière est retirée (`removeBanner`) au rendu suivant.

## Âge et Google Play Families

Le jeu vise un public mixte (enfants, adolescents, adultes). L'âge vient de la question neutre déjà posée par les promotions (« Avez-vous 18 ans ou plus ? »), enregistrée sur l'appareil dans `geo-europe.<pays>.promotions`. Aucune nouvelle question.

| Réponse | Public | Réglages appliqués avant toute requête | Consentement |
| --- | --- | --- | --- |
| « 18 ans ou plus » | `adult` | TFCD `false`, TFUA `false`, classification `G` | UMP : formulaire Google quand la loi l'exige. Aucune annonce si `canRequestAds` est faux ou si UMP échoue. Un refus donne des annonces limitées, non personnalisées, selon la chaîne TCF |
| « Moins de 18 ans », « Plus tard », pas encore répondu, données effacées | `restricted` | TFCD `true`, TFUA `true`, classification `G`, `npa=1` | Aucun appel UMP |

Ordre, à chaque changement de public : `removeBanner`, puis `initialize` avec les réglages (le plugin les passe à `MobileAds.setRequestConfiguration`, valable pour toutes les requêtes suivantes), puis le consentement pour un adulte, puis `showBanner`. Si une étape échoue, aucune bannière (`mayRequestBanner`). La réponse d'âge est suivie en direct (`onAdultAnswerChange` dans `src/services/promotions.ts`) : effacer ses données repasse en public restreint sans redémarrer.

Selon la documentation AdMob (« Targeting », Android) : avec TFCD ou TFUA à `true`, l'identifiant publicitaire Android (AAID) n'est pas transmis ; TFCD exclut la publicité ciblée par centres d'intérêt et le remarketing, TFUA la publicité personnalisée. UMP ne demande pas de consentement quand TFUA est `true`. Ces deux réglages sont marqués comme remplacés par `setAgeRestrictedTreatment` dans les SDK récents, sans être retirés : à revoir à chaque montée de version du plugin.

### Versions du SDK

| Élément | Version | Où |
| --- | --- | --- |
| Capacitor | 8.6.0 | `package.json` |
| `@capacitor-community/admob` | 8.3.0 | `package.json` |
| Google Mobile Ads (`play-services-ads`) | 25.5.0, exacte | `android/variables.gradle` (`playServicesAdsVersion`) |
| User Messaging Platform | 4.0.0, exacte | `android/variables.gradle` (`userMessagingPlatformVersion`) |

La liste « Families Self-Certified Ads SDKs » de Google Play indique Google AdMob, `com.google.android.gms:play-services-ads`, version 19.0.0 ou ultérieure. `npm run check:ads` refuse une version qui n'est pas exacte ou qui est inférieure à 19. Pour vérifier ce que Gradle résout réellement :

```bash
cd android && ./gradlew :app:dependencies --configuration releaseRuntimeClasspath
```

`play-services-ads-identifier` est inclus et déclare la permission `com.google.android.gms.permission.AD_ID`. Pour le lancement, elle est retirée du manifeste fusionné par `tools:node="remove"` dans `android/app/src/main/AndroidManifest.xml`, avec `android.permission.ACCESS_ADSERVICES_AD_ID`. Voir [Données transmises à Google](#données-transmises-à-google).

### Données transmises à Google

Sans la permission AD_ID, le système renvoie un identifiant publicitaire fait de zéros : aucun AAID n'est transmis, à aucun joueur. La bannière fonctionne sans lui : Google sert alors des annonces sans ciblage par identifiant. Constaté sur le Pixel 9 (Android 16) : `dumpsys package fr.javachrist.geofr` ne liste aucune permission AD_ID.

Ce qui reste transmis à Google par le SDK Google Mobile Ads et UMP, pour les éditions avec publicités :

| Donnée | Usage |
| --- | --- |
| App Set ID (identifiant de groupe d'applications, propre à l'éditeur sur l'appareil) | Prévention de la fraude, analyse ; seul identifiant d'appareil restant |
| Adresse IP | Position approximative, prévention de la fraude |
| Modèle, version d'Android, langue, réseau | Diffusion et rendu de l'annonce |
| Application, bloc d'annonce, interactions (affichage, clic) | Diffusion, mesure, facturation de l'annonceur |
| Chaîne TCF et état UMP | Respect du consentement de l'adulte |
| Réglages TFCD, TFUA, `npa`, classification maximale | Protection des mineurs et des âges inconnus |

Restent dans le manifeste fusionné, déclarées par le SDK : `ACCESS_ADSERVICES_ATTRIBUTION` et `ACCESS_ADSERVICES_TOPICS` (Privacy Sandbox sur Android). Elles ne donnent pas d'identifiant ; Topics n'est pas utilisé pour les requêtes marquées enfants ou âge inconnu. À retirer aussi si le questionnaire Families le demande.

### Sauvegarde Android

`android:allowBackup="false"`, avec deux fichiers de règles qui excluent tout :

| Fichier | Versions | Effet |
| --- | --- | --- |
| `res/xml/backup_rules.xml` (`fullBackupContent`) | Android 11 et moins (minSdk 24) | Aucune donnée dans la sauvegarde Google |
| `res/xml/data_extraction_rules.xml` (`dataExtractionRules`) | Android 12 et plus | Aucune donnée en sauvegarde cloud ni en transfert d'appareil à appareil |

Une restauration ne peut donc pas ramener des résultats, des prénoms du Mode Famille, une réponse d'âge ou un consentement UMP effacés. Vérifié sur le Pixel 9 : le paquet installé n'a pas le drapeau `ALLOW_BACKUP`, et `bmgr backupnow fr.javachrist.geofr` répond « Unable to run backup ». L'image de l'émulateur n'a pas de transport de sauvegarde : le test de restauration réel se fait sur un appareil avec compte Google (sauvegarde, désinstallation, réinstallation, les résultats doivent être vides).

## Identifiants

Une application AdMob et un bloc de bannière **par pays**. Deux éditeurs seulement sont acceptés : celui de démonstration de Google (`ca-app-pub-3940256099942544`) et celui de JavaChrist (`ca-app-pub-8288172940135426`). L'ID d'application et le bloc doivent venir du même éditeur.

| Contrôle | Refuse |
| --- | --- |
| `npm run check:ads` | Un ID d'un autre éditeur, deux éditeurs mélangés, un appareil de test mal formé, un `mode` autre que `test` ou `live`, et `live` avec le bloc de démonstration de Google |
| `android/app/build.gradle` | Le build si `admobAppId` n'est pas `ca-app-pub-3940256099942544~…` ou `ca-app-pub-8288172940135426~…` |
| `src/services/ads/admob.ts` | `showBanner` avec un bloc d'un autre éditeur |

### Mode test et mode live

`ads.mode` décide du type d'annonces, pas les identifiants :

- `test` : `showBanner` passe `isTesting: true`. Le plugin remplace alors le bloc réel par le bloc de test de Google (`ca-app-pub-3940256099942544/6300978111`, visible dans logcat), et aucune annonce réelle n'est demandée, sur aucun appareil.
- `live` (actuel, validé par Christian le 13 novembre 2026) : bloc réel `ca-app-pub-8288172940135426/6775667962`, `isTesting: false`. `npm run check:ads` refuse `live` avec le bloc de démonstration de Google.

`ads.admob.testDevices` liste les appareils déclarés au SDK (`initializeForTesting`, `testingDevices`). Ils reçoivent des annonces de test même en `live`, ce qui protège le compte AdMob des clics de développement : le SDK garde le bloc réel et l'indique dans logcat (« This device is registered as Testing Device. The real Ad Id will be used »), mais l'annonce servie porte le libellé « Test Ad ». L'ID d'un appareil s'affiche dans logcat au premier chargement (`Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("…"))`). Déclaré : le Samsung SM-A176B de test.

### Appareil partagé : mode Famille

Tant que l'écran Mode Famille est ouvert (`useRestrictedAdAudience(true)`), le public est `restricted`, même si l'appareil a répondu « 18 ans ou plus ». En entrant dans le mode, `AdsProvider` retire la bannière, réapplique TFCD et TFUA à `true`, `npa: true`, classification G, sans appel UMP, puis seulement redemande une annonce. Les réglages adultes reviennent en quittant le mode, de la même façon. Les vidéos de promotion pour adultes et la question d'âge sont aussi coupées pendant tout le mode (voir [promotions.md](promotions.md)).

### Identifiant publicitaire et Privacy Sandbox

Le manifeste retire `com.google.android.gms.permission.AD_ID`, `ACCESS_ADSERVICES_AD_ID`, `ACCESS_ADSERVICES_TOPICS` et `ACCESS_ADSERVICES_ATTRIBUTION`, déclarées par Google Mobile Ads. `check:ads` le vérifie. Play Console, déclaration « Identifiant publicitaire » : **Non**, l'application n'utilise pas l'identifiant publicitaire. Le manifeste fusionné ne contient pas la permission, donc aucune finalité n'est à cocher.

| Fichier | Contenu |
| --- | --- |
| `content/<pays>/android.json` | `applicationId` (= `androidPackage`), `appName` (= `appName`), `admobAppId`. Lu par `capacitor.config.ts` et par Gradle (`GEO_COUNTRY`) |
| `content/<pays>/country.ts` | `ads: { mode, admob: { androidBannerAdUnitId, testDevices } }`, ou `null` pour aucune annonce |
| `public/app-ads.txt` | `google.com, pub-8288172940135426, DIRECT, f08c47fec0942fa0`, servi à la racine du site web |

GéoFR : application `ca-app-pub-8288172940135426~6935450069`, bannière `ca-app-pub-8288172940135426/6775667962`.
Démonstration Google : application `ca-app-pub-3940256099942544~3347511713`, bannière adaptative `ca-app-pub-3940256099942544/9214589741`.

### Passer aux annonces réelles (validé par Christian le 13 novembre 2026)

Fait : application et bloc créés dans AdMob, ID dans `android.json` et `country.ts`, `public/app-ads.txt` dans le dépôt.

1. Vérifier que `app-ads.txt` est servi à la racine du site déclaré comme site du développeur sur la fiche Google Play, puis que AdMob l'a validé (onglet app-ads.txt, jusqu'à 24 heures).
2. Lier l'application AdMob à l'application Google Play.
3. Dans « Confidentialité et messages », publier le message RGPD (UMP) de l'application.
4. Dans les paramètres de l'application AdMob, déclarer le public : conception pour les familles, contenu G maximum.
5. Fait le 13 novembre 2026 : `ads.mode: "live"`, `adsConfigErrors` n'accepte `live` qu'avec le bloc JavaChrist, versionCode 12. `testDevices` est gardé.

Les étapes 1 à 4 doivent être faites dans AdMob et la Play Console avant d'envoyer l'AAB live en production. Sans elles, AdMob limite ou refuse les annonces réelles.

## Google Play : sécurité des données

Déclaration pour l'application Android construite en canal `play`, avec compte facultatif et Google Play Billing (état au 13 novembre 2026, versionCode 12 en `ads.mode: "live"` : AD_ID retiré, sauvegarde coupée). Finalités AdMob alignées sur la page de Google « Play data disclosure » du SDK : adresse IP, interactions, diagnostics et identifiants sont collectés et partagés pour la publicité, l'analyse et la prévention de la fraude.

- La collecte publicitaire vient du SDK Google Mobile Ads et d'UMP. Elle n'existe que dans les éditions avec publicités, sans accès offert.
- Le compte n'est demandé que pour acheter ou restaurer. La version gratuite n'en demande pas.
- Aucune donnée n'est déclarée en traitement éphémère : Firestore conserve les données du compte, Vercel garde ses journaux 24 heures (adresse IP), Google conserve les données AdMob.
- La rétractation (`/retractation`, ouverte depuis le Profil et la Boutique) conserve 5 ans le nom, l'adresse, la commande et le message : d'où la finalité de conformité.

| Rubrique Play | Collectée | Partagée | Finalités | Facultative | Preuve |
| --- | --- | --- | --- | --- | --- |
| Informations personnelles : adresse e-mail | Oui, seulement avec un compte | Non (Firebase est sous-traitant) | Fonctionnalités de l'application, gestion du compte, prévention de la fraude, sécurité et conformité (rétractation, pièces d'achat) | Oui | `src/services/account.ts`, `src/services/native/google-sign-in.ts`, `src/engine/withdrawal.ts` |
| Informations personnelles : nom (profil Google, formulaire de rétractation) | Oui, avec la connexion Google ou une rétractation | Non | Gestion du compte, prévention de la fraude, sécurité et conformité | Oui | Firebase Auth, `signInWithCredential`, `src/engine/withdrawal.ts` |
| Identifiants : identifiant utilisateur (uid Firebase, `sha256(uid)` transmis à Google Play) | Oui, avec un compte | Non | Fonctionnalités de l'application, gestion du compte, prévention de la fraude | Oui | `preparePlayOrder` dans `src/services/payments/orders.ts` |
| Infos financières : historique des achats (édition, statut, date, jeton haché) | Oui, à l'achat | Non | Fonctionnalités de l'application (droits), prévention de la fraude, sécurité et conformité (jeton Play vérifié par le serveur, pièces comptables 10 ans) | Oui | `orders`, `playPurchases`, `entitlements` dans `firestore.rules` |
| Infos financières : données de paiement | Non : traitées par Google Play, jamais par l'éditeur | Non | | | `PlayBillingPlugin.java` (aucune donnée de carte) |
| Identifiants de l'appareil : App Set ID (pas d'AAID) | Oui | Oui, Google | Publicité, analyse, prévention de la fraude (collecte et partage) | Non dans une édition avec publicités | `AndroidManifest.xml` sans `AD_ID`, `check:ads` |
| Position approximative (déduite de l'IP) | Oui | Oui, Google | Publicité, analyse, prévention de la fraude (collecte et partage) | Non | SDK Google Mobile Ads, journaux Vercel |
| Activité dans l'application : interactions avec l'appli (lancement, appuis, vues d'annonces) | Oui | Oui, Google | Publicité, analyse, prévention de la fraude (collecte et partage) | Non | SDK Google Mobile Ads |
| Activité dans l'application : autres contenus générés par l'utilisateur (message de rétractation) | Oui, seulement s'il est écrit | Non | Fonctionnalités de l'application, prévention de la fraude, sécurité et conformité | Oui | `src/engine/withdrawal.ts` (1 000 caractères au plus) |
| Infos et performances de l'application : diagnostics (temps de lancement, blocages, énergie). Pas de plantages : Google ne les déclare pas | Oui | Oui, Google | Publicité, analyse, prévention de la fraude (collecte et partage) | Non | SDK Google Mobile Ads |
| Messages, photos, contacts, position précise | Non | Non | | | |
| Progression, Mode Famille, réponse d'âge | Non : restent sur l'appareil, hors sauvegarde | Non | | | `src/services/local-progress.ts`, sauvegarde coupée dans le manifeste, aucune écriture Firestore depuis l'application |
| Promotions vidéo | Non : le catalogue est seulement lu, aucune vue ni aucun clic envoyé | Non | | | `src/services/promotions.ts` |

| Pratique de sécurité | Réponse |
| --- | --- |
| Chiffrement en transit | Oui : HTTPS vers le serveur, Firebase et Google |
| Demande de suppression des données | Oui, trois chemins (voir [juridique.md](juridique.md)) :<br>- Supprimer mes données efface l'appareil ;<br>- la suppression du compte se demande à support@appsgeo.com, avec effacement sous 30 jours et pièces comptables conservées ;<br>- les données de Google se gèrent dans les réglages Google et par Choix publicitaires |
| URL de suppression du compte (exigée par Play dès qu'un compte existe) | `https://geofr.appsgeo.com/profil/confidentialite/supprimer-mon-compte`, publique, sans connexion |
| Suppression des données sans supprimer le compte | Non : les données serveur sont liées au compte, et « Supprimer mes données » n'efface que l'appareil |
| Méthodes de création de compte | Nom d'utilisateur et mot de passe, OAuth (Google) |
| Politique de confidentialité | `https://geofr.appsgeo.com/profil/confidentialite/politique`, dans la version publiée par le Legal Kit (pas de brouillon) |
| Public cible | Tranches incluant moins de 13 ans : programme Families, « Contient des annonces » |

Les documents 0.3.2 décrivent encore le compte comme « site web uniquement ». C'est à corriger dans le kit avant de remplir cette déclaration (voir [Legal Kit](#legal-kit--version-032-brouillon)).

## Choix publicitaires

Paramètres et confidentialité, rubrique Gestion des consentements : dans l'application Android, un bloc explique la bannière. Le bouton « Choix publicitaires » apparaît quand UMP l'exige pour un adulte (`privacyOptionsRequirementStatus === "REQUIRED"`) et rouvre le formulaire de Google (`showPrivacyOptionsForm`). Un échec affiche `modal.error` (`adsUnavailable`).

## Tests sur l'émulateur

Le téléphone de test et l'émulateur doivent recevoir des annonces de test : sur un appareil absent de `testDevices`, un build `live` demande des annonces réelles, ne jamais cliquer dessus. `check:ads`, Gradle et `showBanner` refusent tout autre éditeur que la démonstration Google et JavaChrist.

```bash
npm run build:export
```

```bash
npx cap sync android
```

Sous Windows, Gradle a besoin d'un dossier temporaire court, sinon ses sockets locales échouent. Dans `android/local.properties`, `sdk.dir` s'écrit avec des barres obliques (`C:/Users/.../Android/Sdk`). `clean` est nécessaire après un nouvel export, sinon l'APK garde les anciennes pages.

```bash
cd android && TMP='C:\tmp\geofr' TEMP='C:\tmp\geofr' JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:\tmp\geofr -Djava.io.tmpdir=C:\tmp\geofr' ./gradlew clean assembleDebug
```

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Pour rejouer le formulaire UMP, on efface les données de l'application, en test seulement. L'application n'appelle jamais `resetConsentInfo()` : un adulte modifie son choix par Choix publicitaires.

```bash
adb shell pm clear fr.javachrist.geofr
```

### Taille de l'application : pack d'assets

Les photos ne sont plus dans l'application de base.

- `npm run android:sync` lance `npx cap sync android`, puis `scripts/android-media.mjs`.
- Ce script déplace `public/media/` vers le pack d'assets Play `media_pack`, en livraison `install-time`.
- Les photos gardent leur chemin : la WebView les lit par l'AssetManager, qui fusionne la base et le pack.

Mesures après l'allègement de l'export (novembre 2026) :

| Élément | Taille |
| --- | --- |
| `out/` | 713 Mo (4,7 Go avant) |
| Module de base de l'AAB | 17,7 Mo |
| Pack `media_pack` | 635,1 Mo |
| APK de debug (tout compris, pour l'émulateur) | 690 Mo |

Google Play accepte un module de base de 200 Mo au plus et des packs `install-time` jusqu'à 4 Go au total. `bundleRelease` produit l'AAB à envoyer, et `assembleDebug` un APK unique pour les tests locaux.

### Clé d'envoi (signature de l'AAB)

Google Play garde la clé de signature de l'application (Play App Signing). Nous ne gardons que la **clé d'envoi**, qui signe l'AAB envoyé à la Play Console. Elle et ses mots de passe ne sont jamais dans le dépôt ni dans une conversation.

La clé de GéoFR existe depuis le 10 novembre 2026 : `C:\Users\JavaChrist\Documents\Keystores\geofr-upload.jks`, alias `upload`, RSA 4096, validité 10 000 jours, certificat « CN=GeoFR Upload, O=JavaChrist, C=FR ». Ne pas en créer une autre. Les étapes ci-dessous servent pour un nouveau pays ou un nouveau poste.

1. Créer la clé, hors du dépôt. `keytool` est fourni avec le JDK d'Android Studio et demande lui-même les mots de passe :

   ```bash
   keytool -genkeypair -v -keystore "$USERPROFILE/Documents/Keystores/geofr-upload.jks" -alias upload -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Créer `%USERPROFILE%\.geofr\keystore.properties` :

   ```properties
   storeFile=C:/Users/<utilisateur>/Documents/Keystores/geofr-upload.jks
   storePassword=<mot de passe du keystore>
   keyAlias=upload
   keyPassword=<mot de passe de la clé>
   ```

   La variable `GEOFR_KEYSTORE_PROPERTIES` permet de lire ce fichier ailleurs.

3. Sauvegarder le `.jks` et ses mots de passe dans le gestionnaire de mots de passe. Une clé d'envoi perdue se remplace par une demande au support Google Play, ce qui prend plusieurs jours.

Chaque AAB envoyé à Google Play doit avoir un `versionCode` plus grand que le précédent (`android/app/build.gradle`). Le `versionName` reste « 1.0 » tant que Christian ne demande pas autre chose.

### Icône de lancement

Les icônes `android/app/src/main/res/mipmap-*/` viennent de `public/logo512.png`, le logo de l'application :

- `ic_launcher.png` : le logo complet, de 48 à 192 px ;
- `ic_launcher_round.png` : le logo à 76 % sur un disque bleu nuit, pour que « GéoFR » ne touche pas le bord ;
- `ic_launcher_foreground.png` : le logo sans son cadre lumineux, sur 56 dp des 108 dp de l'icône adaptative, pour rester entier dans les masques ronds ;
- fond de l'icône adaptative : `ic_launcher_background`, `#001B60`, le bleu nuit du logo.

Vérifié le 10 novembre 2026 dans le tiroir d'applications du Pixel 9 (Android 16) et dans l'AAB (versionCode 2).

### Bouton retour d'Android

`MainActivity` enregistre un `OnBackPressedCallback`. À chaque appui, il demande d'abord à la page `window.__geoNativeBack()` :

- pendant une partie (niveau, défi spécial, Mode Famille), la fonction existe, ouvre la modale « Quitter le quiz ? » et rend `true` : Android ne fait rien d'autre, l'historique de la WebView n'est pas touché ;
- sinon, la WebView remonte son historique (`goBack`), et sans historique Android reprend son comportement normal (retour à l'écran d'accueil).

La page ne peut pas se contenter d'une entrée d'historique « piège » sur Android : Chromium saute au retour une entrée suivie d'un ajout fait sans geste du joueur, donc le deuxième retour vidait l'historique et fermait l'application. Le détail est dans `src/ui/nav/leave-guard.tsx`, qui protège aussi la navigation du bas, l'en-tête et le retour du navigateur sur le site.

Vérifié le 10 novembre 2026 sur un émulateur 360 × 640 dp (Android 16) : modale à chaque onglet et à chaque retour, l'application reste au premier plan, « Quitter » ramène au parcours, retour normal après la fin de la partie (AAB versionCode 3).

`android/app/build.gradle` signe `bundleRelease` dès que ce fichier existe, et refuse un fichier incomplet. Sans le fichier, l'AAB sort non signé, et la Play Console le refuse. `android/.gitignore` exclut `*.jks`, `*.keystore` et `keystore.properties` par sécurité.

Pour vérifier la signature et lire les empreintes :

```bash
keytool -list -v -keystore "$USERPROFILE/.geofr/geofr-upload.jks" -alias upload
```

Firebase Android (connexion Google) attend les empreintes SHA-1 :

- de la clé de débogage, pour l'émulateur ;
- de la clé d'envoi ;
- de la **clé de signature de l'application** affichée par la Play Console (Intégrité de l'application), car c'est elle qui signe l'application installée depuis Google Play.

### Variantes du build

| Variable | Effet |
| --- | --- |
| `NEXT_PUBLIC_ADS_DEBUG_EEA=1` | UMP se comporte comme dans l'Espace économique européen (formulaire de consentement) |
| `NEXT_PUBLIC_ADS_TEST_NO_ADS=1` | Aucune annonce. Il vérifie le chemin natif « sans publicités », pas les droits réels (voir [Droits réels](#droits-réels-et-publicité)) |
| `NEXT_PUBLIC_API_BASE_URL=https://<serveur>` | Comptes, droits et Google Play Billing dans l'application (canal `play`). Sans elle : canal `off`, tout le monde en Découverte, ni compte ni Boutique. **Obligatoire pour un build release** : Gradle le refuse sinon |
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Connexion Google native (identifiant client OAuth Web de Firebase, public) |
| `GEO_COUNTRY=<pays>` | Pays de l'application, pour `capacitor.config.ts`, Gradle et le contenu |

`npm run build:export` écrit `out/geo-export.json` (`{ "payments": "play" | "off", "apiBase": "…" }`, aucune donnée secrète). Avant un build release (`bundleRelease`, `assembleRelease`), Gradle lit ce marqueur dans les assets copiés par `android:sync` et refuse le build si le canal n'est pas `play`. Un export sans serveur reste possible pour l'émulateur, en debug seulement. Commande d'un AAB pour Google Play :

```bash
NEXT_PUBLIC_API_BASE_URL=https://geofr.appsgeo.com npm run build:export
```

```bash
npm run android:sync
```

```bash
cd android && TMP='C:\tmp\geofr' TEMP='C:\tmp\geofr' JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:\tmp\geofr -Djava.io.tmpdir=C:\tmp\geofr' ./gradlew clean bundleRelease
```

### Déboguer la WebView

Le build debug ouvre la WebView aux outils Chrome. Capacitor sert les pages exportées avec leur suffixe : naviguer vers `/explorer/ile-de-france/ile-de-france/bienvenue.html`, sans `.html` on retombe sur l'accueil. Les appels au plugin se lisent dans `adb logcat` (lignes `Capacitor/Plugin ... methodName`), et une page rechargée repart de zéro côté JavaScript alors que la vue native reste : `AdsProvider` commence donc toujours par `removeBanner`.

```bash
adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>
```

### Résultats (Pixel 9, Android 16, novembre 2026)

| Cas | Résultat |
| --- | --- |
| Chargement, âge inconnu | `removeBanner`, `initialize` (TFCD et TFUA `true`, classification `General`, test), puis un seul `showBanner` avec `npa: true` et une marge de 64. Bannière de test 411 × 64 juste au-dessus de la barre de navigation, 5 boutons utilisables, bas de page accessible. Premier chargement lent sur l'émulateur (environ 20 s) |
| Âge inconnu en Europe (build EEA) | Aucun appel UMP : pas de formulaire pour un mineur ou un âge inconnu |
| Erreur réseau (mode avion) | `Ad failed to load : 0`, puis `removeBanner` : aucune bannière, aucun espace réservé |
| Partie en cours | `hideBanner` au début de la partie, `--ad-banner-h` à 0, aucune bannière sur l'écran de jeu. Modale de confirmation pour quitter : aucun appel en plus. Retour au parcours : `resumeBanner`, sans nouvelle requête |
| Page rechargée | Corrigé pendant les tests : le plugin ne répond jamais à un `showBanner` quand une bannière native existe déjà, ce qui bloquait le masquage pendant la partie. `AdsProvider` retire maintenant toute bannière restante avant d'en demander une |
| Adulte en Europe | `initialize` avec TFCD et TFUA `false`, `requestConsentInfo` avec la géographie EEA, puis `showConsentForm` avant toute requête |
| Adulte qui refuse (« Do not consent ») | UMP répond `OBTAINED`, `canRequestAds: true` et enregistre des consentements TCF tous à 0. C'est le fonctionnement normal de Google : le refus n'interdit pas l'annonce, le SDK lit la chaîne TCF et ne sert que des annonces limitées, sans personnalisation. La bannière s'affiche donc. Elle ne serait pas demandée si `canRequestAds` était faux (formulaire non rempli ou échec UMP) |
| Choix publicitaires | Bouton présent dans Profil, Confidentialité, Consentements pour un adulte en Europe ; il rouvre le formulaire Google (`showPrivacyOptionsForm`) |
| Build sans publicités | Aucune bannière, ni `initialize`, ni UMP, ni requête vers les serveurs Google dans `adb logcat`. Seul appel : `removeBanner`, local et sans réseau, qui retire une bannière restée d'une page précédente (par exemple juste après un achat sans publicités) |

### Contrôle après l'audit (9 novembre 2026, textes juridiques 0.3.1, sans AD_ID ni sauvegarde)

Émulateur remis à zéro (`-wipe-data`), APK reconstruit avec les textes 0.3.1 :

| Cas | Résultat |
| --- | --- |
| Premier lancement, âge inconnu | `initialize` avec TFCD et TFUA `true`, `showBanner` avec `npa: true`, identifiant de démonstration, aucun appel UMP |
| Mineur déclaré | Comme l'âge inconnu : réglages enfant et mineur, `npa: true`, aucun appel UMP |
| Adulte (build EEA) | Formulaire Google avant toute bannière. Refus : consentements TCF `00000000000` |
| Redémarrage | Le formulaire ne revient pas, le choix enregistré est gardé, `requestConsentInfo` puis `showBanner` |
| Choix publicitaires | `showPrivacyOptionsForm` rouvre le formulaire. Accord donné ensuite : consentements `11111111111` |
| Effacement local | Au clic sur Supprimer : `removeBanner`, puis effacement de toutes les clés `localStorage`. Aucune requête tant que la confirmation est ouverte. Après « OK » : `initialize` avec TFCD et TFUA `true`, `showBanner` avec `npa: true` (âge inconnu) |
| Build sans publicités, adulte déclaré | Aucun `initialize`, aucun appel UMP, aucun `showBanner`, aucune ligne `doubleclick` ou `googleads` dans `adb logcat`. Seul `removeBanner`, local |

Décision de Christian (9 novembre 2026) : pour un adulte qui refuse, on garde le comportement de Google. Pas de `npa: true` forcé, le SDK applique la chaîne TCF et ne sert que des annonces limitées, non personnalisées.

## Droits réels et publicité

`AdsProvider` ne demande une annonce que si `adsAllowed()` l'autorise. Il lui passe les vrais droits de `useEntitlements()` :

- `entitlements.adsRemoved` ;
- `entitlements.granted` ;
- `status === "ready"`.

Corrigé le 9 novembre 2026 : l'état `offline` (droits d'un compte connecté illisibles) ouvrait la bannière avec les droits gratuits. Il la bloque maintenant, car il n'y a jamais d'annonce dans le doute.

`check:ads` (sections 6 et 7) part des commandes, calcule les droits avec `computeEntitlements` et `effectiveEntitlements`, puis applique la décision :

| Droits | Bannière |
| --- | --- |
| Sans compte, Découverte | Oui |
| Solo avec publicités, Famille avec publicités | Oui |
| Solo sans publicités, Famille sans publicités | Non |
| Accès offert, avec ou sans achat | Non |
| Sans publicités, plus une autre commande remboursée | Non |
| Sans publicités remboursé | Oui (droits retirés) |
| Commande `pending`, `open`, `authorized` ou `created` | Oui (pas encore de droit) |
| Droits en chargement ou illisibles | Non |

Le même script vérifie aussi que seul `AdsProvider` appelle `applyRequestSettings`, `gatherConsent`, `showBanner` ou `resumeBanner`.

Sur l'émulateur, un compte réel Solo sans pub, Famille sans pub ou accès offert demande le serveur déployé avec `withAppCors` et un build `NEXT_PUBLIC_API_BASE_URL`. Ce test reste à faire après le déploiement validé par Christian. Le build `NEXT_PUBLIC_ADS_TEST_NO_ADS` seul ne le remplace pas.

## Avant une publication Google Play

Construit, en mode test :

- connexion Firebase (e-mail et Google natif) ;
- Google Play Billing, avec vérification par le serveur ;
- restauration ;
- accès offerts sans publicité ni Play Billing ;
- pack d'assets.

Voir [paiements.md](paiements.md#google-play-application-android).

Reste, avec la validation de Christian :

1. Déployer le serveur (routes Google Play, CORS de l'application) et publier les règles Firestore.
2. Configurer la Play Console, Pub/Sub et Firebase Android (voir [paiements.md](paiements.md#configuration-google-play-à-faire-validation-de-christian)).
3. Tester en piste interne avec un testeur de licence.
4. Fait : `ads.mode: "live"` (13 novembre 2026). Reste à remplir la déclaration de sécurité des données et le questionnaire Families.
5. Faire mettre à jour les documents juridiques par le Legal Kit (section suivante).

## Legal Kit : version 0.3.2 (brouillon)

Corrections appliquées le 9 novembre 2026 dans la source du kit (`JavaChrist-Legal-Kit/apps/geofr.json`), générées puis copiées par `node scripts/sync-legal.mjs fr geofr 0.3.2-draft`. Le champ `review` n'est pas touché.

- `features.ads` et `features.accounts` passent à `true` : rubriques Publicité et Compte dans la politique.
- Traitements par plateforme : progression, Mode Famille et réponse d'âge sur l'appareil (web et Android) ; compte et accès offerts (web) ; achat web (Mollie) ; achat Android (Google Play Billing) ; rétractations ; bannière AdMob (Android) ; vidéos de promotion ; journaux Vercel (24 heures, offre Pro sans drain, vérifié dans l'équipe Vercel).
- Prestataires : Vercel, Firebase du projet GéoFR (Firestore `nam5`, États-Unis), Firebase du catalogue des promotions, Google AdMob et UMP, Google Play, Mollie B.V., IONOS SE.
- Clauses réécrites sans formule provisoire : `eligibility`, `compatibility`, `security`, `cookies`, `ads`, `accounts`, `minors`, `deletion`, `export`, et `withdrawal` (absente, elle bloquait la génération).
- L'effacement local ne supprime pas les données déjà transmises à Google et ne retire pas le consentement : il se modifie depuis Choix publicitaires.

Le bandeau BROUILLON ne disparaît qu'avec `npm run generate -- --app geofr --publish` puis `sync-legal … <version>-reviewed`. Durées de conservation validées par Christian le 9 novembre 2026 et inscrites en 0.3.2 : compte, jusqu'à sa suppression demandée à support@appsgeo.com puis effacement sous 30 jours ; droits d'accès, tant que le compte existe ; rétractations, 5 ans (article 2224 du Code civil). Le kit ne signale plus qu'un point, mais refuse encore la publication pour trois raisons :

1. Aucune offre `active` dans `catalogs/geofr.json` : toutes restent `planned` jusqu'à la validation d'une vente.
2. `review.configurationSha256` contient un texte au lieu de l'empreinte affichée par le kit (`efc3c9bd…5b08e5f2` pour 0.3.2). Christian la recopie lui-même après relecture.
3. Google Play Billing est maintenant construit en mode test (voir [paiements.md](paiements.md#google-play-application-android)), à vérifier en piste interne avant publication.

À corriger dans la source du kit, pas à la main, avec la validation de Christian :

- Le traitement « Compte joueur, connexion et accès offerts » porte encore « site web uniquement ». L'application Android a désormais des comptes, en canal `play`.
- La politique renvoie l'exercice des droits à support@javachrist.fr. La rubrique Suppression et le jeu utilisent support@appsgeo.com.

## Ajouter un pays (GéoDE, GéoES, GéoIT)

1. `content/<pays>/android.json` avec `applicationId`, `appName` et l'ID d'application de démonstration.
2. `ads` dans `content/<pays>/country.ts`, avec `mode: "test"`, le bloc de démonstration et `testDevices: []`, ou `null`.
3. `GEO_COUNTRY=<pays> npm run check:ads`.
4. Plus tard, avec validation : une application AdMob propre au pays, son message UMP, ses ID.

Rien de propre à un pays dans `src/` : la question d'âge, les règles et l'interface sont communes.
