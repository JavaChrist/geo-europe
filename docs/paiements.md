# Paiements et droits d'accès

Achat web des éditions par Mollie, droits d'accès vérifiés par le serveur. Commun à tous les pays de la collection.

**État : vente réelle ouverte sur le web, validée par Christian le 10 novembre 2026.** Les éditions sont `active` et le mode Mollie suit la clé : `test_…` pour le mode test, `live_…` pour la vente réelle. Le serveur n'accepte une clé `live_` que si toutes les éditions payantes sont `active`. Google Play reste en mode test (`PLAY_MODE` dans `orders.ts`) et l'application affiche l'avis « mode test » tant que sa configuration n'est pas terminée. Les points encore ouverts sont dans [Avant la vente réelle](#avant-la-vente-réelle).

## Droits

| Édition | Régions | Niveaux, défis Solo, album | Mode Famille | Sans publicités ni promotions |
| --- | --- | --- | --- | --- |
| Découverte gratuite, sans compte | Celles de `regions` dans `editions.ts` (GéoFR : Île-de-France, Occitanie) | Dans ces régions | Non | Non |
| `solo_ads` | Toutes | Oui | Non | Non |
| `solo_no_ads` | Toutes | Oui | Non | Oui |
| `family_ads` | Toutes | Oui | Oui | Non |
| `family_no_ads` | Toutes | Oui | Oui | Oui |

Défis nationaux (voir [defis-nationaux.md](defis-nationaux.md)) : le Défi du jour se tire dans les régions accessibles, le Défi de France est verrouillé en Découverte, et les Défis thématiques se jouent en Découverte avec les seules questions des régions gratuites, sans badge.

La carte de France reste consultable par tous. La progression reste sur l'appareil, avec ou sans compte : se connecter ne l'efface pas.

Les droits sont calculés par `computeEntitlements()` (`src/engine/entitlements.ts`) à partir des seules commandes payées :

```ts
{ fullGameAccess, familyAccess, adsRemoved, editions }
```

Un même calcul sert à la notification, à la restauration et au rattrapage.

Un **accès offert** par un administrateur s'y ajoute sans commande : `effectiveEntitlements()` réunit les achats et l'accès, et le document de droits porte `granted: true`. Une révocation laisse les achats réels intacts. Voir [acces-offerts.md](acces-offerts.md).

`adsRemoved` coupe les vidéos de JavaChrist-Promotions, la question d'âge et toute lecture du catalogue (voir [promotions.md](promotions.md#éditions-sans-publicités)). Dans l'application Android, `adsRemoved` et `granted` coupent aussi la bannière AdMob avant toute requête (voir [admob.md](admob.md#qui-voit-une-annonce)).

### Un seul achat

Un compte possède au plus une édition payante. Tout second achat est refusé (`upgradeUndefined`), y compris une montée de Solo vers Famille : aucun tarif de mise à niveau n'est défini sans validation. Pendant qu'un paiement est en cours, la même édition reprend le paiement existant, et une autre édition est refusée (`otherInProgress`).

## Parcours d'achat

1. **Boutique** `/boutique`. Elle montre les quatre éditions, le prix TTC et « Achat unique, sans abonnement ». Les régions verrouillées et le Mode Famille y renvoient.
2. **Connexion** `/connexion?suite=…`. Elle passe par Google ou par e-mail et mot de passe, et l'adresse doit être confirmée. Elle ramène ensuite à l'édition choisie.
3. **Consentements.** Deux cases, jamais cochées d'avance, remises à zéro à chaque choix :
   - acceptation des CGV, avec un lien vers elles ;
   - demande d'accès immédiat et renoncement au droit de rétractation.

   Le bouton reste inactif tant qu'elles ne sont pas cochées.
4. **Commande.** `POST /api/payments/checkout` lit le prix dans `editions.ts`, jamais dans la requête. Il crée `orders/{id}`, puis le paiement Mollie avec une clé d'idempotence, et ne renvoie que `checkoutUrl` et `orderId`.
5. **Retour** `/boutique/retour?commande=…`. Le retour n'est jamais une preuve de paiement : la page interroge `POST /api/payments/sync`, qui relit le paiement chez Mollie. Elle affiche l'un de ces écrans : vérification, en attente, payé, annulé, expiré, échoué, remboursé ou problème.
6. **Notification** `POST /api/payments/webhook`. Mollie n'envoie que l'identifiant du paiement, et le serveur relit le paiement chez Mollie avant de décider.

### Contrôles à chaque relecture

`assessPayment()` (`src/engine/payments.ts`) compare le paiement relu à la commande : identifiant du paiement, commande en métadonnée, montant, devise et mode (`test` ou `live`). À la moindre différence, aucun droit n'est accordé et l'écart est écrit dans l'historique de la commande.

Le traitement est idempotent : une notification rejouée ne change rien. Une notification illisible ou un paiement inconnu reçoit une réponse 200 sans effet, pour que Mollie cesse de la renvoyer.

### Remboursement et rétrofacturation

| Situation | Statut | Droits |
| --- | --- | --- |
| Remboursement partiel | `paid`, `partiallyRefunded: true`, `refundedCents` | Conservés. **Politique à valider par Christian** |
| Remboursement total | `refunded` | Retirés |
| Rétrofacturation | `charged_back` | Retirés |
| Annulé, expiré, échoué | `canceled`, `expired`, `failed` | Aucun. Un nouvel achat est possible |

Une commande ne revient jamais d'un état final vers un état antérieur (`nextOrderStatus()`).

### Rattrapage

`GET /api/payments/reconcile` relit chez Mollie les commandes en cours, renvoie les accusés de rétractation non partis, et les commandes payées depuis moins de 180 jours (remboursement ou contestation tardifs), et corrige les droits si une notification a été perdue. La route exige l'en-tête `Authorization: Bearer <CRON_SECRET>`, que Vercel Cron envoie de lui-même. La tâche est déclarée dans `vercel.json`, une fois par jour, ce que permet l'offre Hobby.

### Restauration

Il y a deux façons de retrouver ses droits :

- se connecter sur un autre appareil : les droits sont lus dans Firestore ;
- le bouton « Restaurer mes achats » du Profil (`POST /api/entitlements/restore`) : les droits sont recalculés depuis les commandes.

## Données Firestore

| Chemin | Contenu | Écrit par |
| --- | --- | --- |
| `orders/{id}` | Compte, application, édition, montant et devise lus par le serveur, mode, statut, paiement Mollie, remboursements, consentements avec version des CGV et date, historique | Serveur uniquement |
| `entitlements/{app}/users/{uid}` | Droits calculés, accès offert (`granted`), commandes sources, date | Serveur uniquement |
| `grants/{app}/emails/{adresse}`, `admins/{uid}` | Accès offerts et administrateurs ([acces-offerts.md](acces-offerts.md)) | Serveur et `scripts/admin.mjs` uniquement |
| `withdrawals/{app}/requests/{id}` | Demandes de rétractation ([retractation.md](retractation.md)) | Serveur uniquement |

`firestore.rules` permet seulement à un joueur connecté de lire ses propres droits et commandes. Toute écriture depuis le navigateur est refusée, et `grants`, `admins` comme `withdrawals` ne sont même pas lisibles. Le serveur écrit avec Firebase Admin, qui n'existe que dans les routes `route.server.ts`.

Les règles se publient avec la commande suivante :

```bash
npx firebase-tools deploy --only firestore:rules --project geofr-d5224
```

### Sans réseau ni Firebase

`EntitlementsProvider` (`src/features/account/`) donne à toute l'application une seule couche de droits. Son état est `loading`, `ready` ou `offline`, et `enabled` dit si les paiements existent dans ce build.

- Sans Firebase configuré, ou dans l'export Android, la Découverte gratuite s'ouvre.
- Hors ligne ou en cas d'erreur, seuls les droits déjà reçus de Firestore pendant la session servent. Aucun droit n'est lu dans le stockage local. Sans eux, seule la Découverte s'ouvre, et le Profil le signale.

Les verrous sont `RegionGate` (layout `src/app/explorer/[slug]/layout.tsx`, qui couvre parcours, niveaux et défis), la carte de verrou du Mode Famille et celles des défis nationaux (`src/features/national/`). Rien n'est jamais ouvert sur la seule foi du navigateur pour une édition payante.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/engine/entitlements.ts` | Droits, droits effectifs avec l'accès offert, Découverte, refus d'un second achat, `productIdOf` |
| `src/engine/payments.ts` | Montants, contrôle d'un paiement relu, transitions de statut, interface `PaymentProvider` |
| `src/services/firebase/client.ts` | Firebase navigateur : Auth, lecture Firestore, émulateurs |
| `src/services/firebase/admin.ts` | Firebase Admin, serveur uniquement |
| `src/services/payments/mollie.ts` | Fournisseur Mollie, clé de test exigée |
| `src/services/payments/orders.ts` | Commandes, notification, synchronisation, restauration avec activation des accès offerts, rattrapage |
| `src/services/grants.ts`, `src/app/api/admin/grants/route.server.ts` | Accès offerts, voir [acces-offerts.md](acces-offerts.md) |
| `src/services/account.ts` | Connexion, lecture des droits, appels aux routes |
| `src/app/api/payments/*/route.server.ts` | `checkout`, `webhook`, `sync`, `reconcile`, `google-play/{prepare,verify,notify}` |
| `src/engine/google-play.ts`, `src/services/payments/google-play.ts` | Règles Play sans réseau ; API Google Play Developer et Pub/Sub en REST (`node:crypto`), serveur uniquement |
| `src/services/billing.ts`, `android/app/src/main/java/fr/javachrist/geofr/PlayBillingPlugin.java` | Achat, restauration et écoute Google Play dans l'application |
| `src/services/payments/http.ts` | Erreurs HTTP, CORS de l'application (`withAppCors`) |
| `src/app/api/entitlements/restore/route.server.ts` | Restauration |
| `src/features/account/` | `EntitlementsProvider`, connexion, Compte du Profil, verrous |
| `src/features/shop/` | Boutique et écrans de retour |
| `firestore.rules`, `firestore.indexes.json`, `firebase.json` | Règles, index, émulateurs |
| `scripts/check-payments.mjs` | Tests unitaires, lancés par `npm run check` |
| `scripts/test-payments-emulator.mjs` | Tests d'intégration, `npm run test:payments` |

## Variables d'environnement

Elles se règlent dans Vercel, et en local dans `.env.local`, qui n'est jamais versionné. Leurs noms sont listés dans `.env.example`. **Ne jamais écrire de valeur secrète dans un document ni dans le dépôt.**

| Variable | Où | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Navigateur | Configuration publique Firebase |
| `NEXT_PUBLIC_FIREBASE_EMULATORS` | Navigateur, local | `1` pour viser les émulateurs |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Serveur | Compte de service Firebase Admin. Secret |
| `MOLLIE_API_KEY` | Serveur | Clé Mollie. `test_…` pour le mode test, `live_…` seulement si toutes les éditions payantes sont `active`. Secret |
| `APP_BASE_URL` | Serveur | Adresse du site, pour l'URL de retour |
| `PAYMENTS_WEBHOOK_BASE_URL` | Serveur | Adresse publique joignable par Mollie, pour l'URL de notification |
| `CRON_SECRET` | Serveur | Au moins 16 caractères, protège le rattrapage. Secret |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_REPLY_TO` | Serveur | Envoi des courriels, voir [courriels.md](courriels.md). `SMTP_PASSWORD` est secret |

`NEXT_PUBLIC_PAYMENTS` est fixé par `next.config.ts`. Il vaut `web` sur le site. Dans l'export statique, il vaut `play` avec `NEXT_PUBLIC_API_BASE_URL`, sinon `off`. Pour les variables Google Play, voir [Google Play](#variables-du-serveur-pour-google-play).

## Tests

`npm run check` lance `check:payments`, qui couvre :

- le calcul des droits ;
- la Découverte ;
- le refus d'un second achat ;
- les montants ;
- les contrôles d'un paiement ;
- les transitions de statut.

`npm run test:payments` lance les émulateurs Auth et Firestore, un faux Mollie local en HTTPS, un faux serveur SMTP et le serveur Next. Il faut d'abord lancer `npm run build`, puis Java pour l'émulateur Firestore. Il couvre 44 scénarios :

- refus sans compte, avec une adresse non confirmée ou sans consentement ;
- prix lu par le serveur ;
- reprise d'une commande en cours ;
- notifications mal formées, rejouées ou falsifiées ;
- droits Solo et Famille ;
- second achat bloqué ;
- restauration ;
- commande d'un autre compte ;
- remboursement partiel puis total ;
- rétrofacturation ;
- annulé, échoué ou expiré ;
- rattrapage ;
- confirmation d'achat envoyée une seule fois, vérification d'adresse et mot de passe oublié ([courriels.md](courriels.md)) ;
- accès offerts : administration, ajout avant ou après le compte, adresse non vérifiée, révocation, achat conservé ([acces-offerts.md](acces-offerts.md#tests)) ;
- rétractation : demande sans compte, commande d'un autre joueur, Google Play, administration, rattrapage de l'accusé ([retractation.md](retractation.md)) ;
- règles Firestore.

Sous Windows, si l'émulateur Firestore échoue avec « Unable to establish loopback connection », donner à Java un dossier temporaire court sans accent :

```bash
TMP='C:\tmp\geofr' TEMP='C:\tmp\geofr' JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:\tmp\geofr -Djava.io.tmpdir=C:\tmp\geofr' npm run test:payments
```

Ces tests n'atteignent pas la vraie page Mollie. Un achat de bout en bout en mode test se fait sur le site déployé, avec la clé `test_` de Christian, en choisissant « Paid », « Failed », « Canceled » ou « Expired » sur la page de test de Mollie. Il faut aussi tester un remboursement depuis le tableau de bord Mollie.

## Google Play (application Android)

L'application Android ne propose jamais Mollie : Google Play impose sa facturation pour un contenu numérique. Elle est construite par `npm run build:export` avec `NEXT_PUBLIC_API_BASE_URL=https://<serveur>` (origine HTTPS, sans chemin). `paymentChannel()` vaut alors `play` et `apiUrl()` vise le serveur Vercel. Sans cette variable, le canal est `off` : pas de compte, pas de boutique, tout le monde en Découverte avec publicités.

L'application ne contient ni secret ni Firebase Admin. Elle lit ses droits dans Firestore (lecture seule) et appelle les routes HTTPS du serveur avec le jeton Firebase du joueur.

### Produits

| Édition | Produit Play (achat unique, non consommable) | Prix de référence |
| --- | --- | --- |
| Solo avec publicités | `geofr_solo_ads` | 9,99 € |
| Solo sans publicités | `geofr_solo_no_ads` | 14,99 € |
| Famille avec publicités | `geofr_family_ads` | 14,99 € |
| Famille sans publicités | `geofr_family_no_ads` | 19,99 € |

Les identifiants viennent de `productIdOf(appId, editionId)`. Les prix sont ceux de `content/fr/editions.ts`, à recopier tels quels dans la Play Console. L'application affiche le prix localisé renvoyé par Google Play.

### Parcours

1. **Préparer** (`POST /api/payments/google-play/prepare`, adresse confirmée exigée).
   - Le serveur contrôle les consentements et la règle d'un seul achat, accès offert compris.
   - Il crée la commande `orders/{id}` avec `provider: "google_play"` et `mode: "test"`.
   - Il renvoie le produit, `obfuscatedAccountId = sha256(uid)` et `obfuscatedProfileId = id de commande`.
   - Une commande Play préparée mais jamais payée (achat annulé) est réutilisée pour la même édition, et annulée si le joueur choisit une autre édition. Elle ne bloque jamais un achat web.
2. **Acheter.** Le plugin local `PlayBilling` (Java, Billing Library 8) relit la fiche du produit, puis ouvre la feuille Google Play. L'application n'accuse **jamais** réception elle-même.
3. **Vérifier** (`POST /api/payments/google-play/verify`).
   - Le serveur relit l'achat avec l'API Google Play Developer (`purchases.products.get`).
   - Il le confronte à la commande (`assessPlayPurchase`) : produit, compte (`obfuscatedExternalAccountId`), commande (`obfuscatedExternalProfileId`), mode (testeur de licence ou réel) et jeton.
   - Au moindre écart, l'achat est refusé : aucun droit, aucun accusé. Google le rembourse de lui-même au bout de 3 jours.
4. **Écrire**, dans une transaction :
   - le jeton dans `playPurchases/{sha256(jeton)}` (serveur seul) ;
   - la commande en `paid` ;
   - les droits recalculés.

   Ensuite seulement, le serveur accuse réception (`:acknowledge`) et note `acknowledged: true`. Le courriel de confirmation part une seule fois.

| Cas | Traitement |
| --- | --- |
| Paiement différé | Commande `pending`, aucun droit. Elle passe à `paid` par la notification Google, le rattrapage ou `purchaseUpdated` dans l'application |
| Achat annulé par le joueur | Aucun appel au serveur. La commande préparée reste réutilisable |
| Jeton rejoué | `playPurchases` rattache chaque jeton à une seule commande. Même commande : rien ne change. Autre commande : refus |
| Achat d'un autre compte | `403`, message « achat d'un autre compte ». Un achat, un compte ; un compte, un achat |
| Second achat payant | Refusé (`secondPurchase`), jamais accusé, donc remboursé par Google |
| Accusé de réception en échec | Les droits sont écrits. Le rattrapage relance l'accusé tant que `acknowledged` est faux |
| Remboursement, annulation, rétrofacturation | Notification `voidedPurchaseNotification`, ou `voidedpurchases.list` au rattrapage. La commande passe à `refunded`, ou à `charged_back` pour la raison 7. Seuls les droits de cette commande sont retirés |
| Achat réel pendant les tests | Refusé (mode `live` au lieu de `test`) tant que `PLAY_MODE` reste `test` |

Les remboursements Play se font dans la Play Console. Ils ne passent jamais par l'application ni par la rétractation en ligne (voir [retractation.md](retractation.md)).

Le courriel de confirmation indique le prix de référence en euros de `editions.ts`, pas le prix localisé débité par Google. C'est à reprendre avant la vente si les prix Play diffèrent.

### Restauration

Le bouton « Restaurer mes achats » est dans la boutique et dans le Compte, pour un compte confirmé sans accès offert.

- Chaque achat présent sur l'appareil (`queryPurchases`) est revérifié par le serveur.
- Un achat sans commande est ignoré.
- Un achat d'un autre compte n'est signalé que si rien n'a été restauré.

À chaque connexion, la restauration du serveur recalcule aussi les droits. Un achat fait sur le web revient donc dans l'application, et inversement.

### Notifications et rattrapage

- `POST /api/payments/google-play/notify` reçoit les notifications développeur en temps réel (RTDN).
  - Elles arrivent par un abonnement Pub/Sub **push**, avec authentification OIDC.
  - Le serveur vérifie la signature Google, l'émetteur, l'audience (`GOOGLE_PLAY_RTDN_AUDIENCE`) et le compte de service (`GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT`).
  - Sans cette configuration, toute notification est refusée. La route répond `204`.
- `/api/payments/reconcile` (tâche planifiée) relit les commandes Play `pending` ou non accusées, puis les achats annulés des 30 derniers jours. Cette étape est sautée si `GOOGLE_PLAY_CLIENT_EMAIL` manque.

### Appels depuis l'application

Les routes appelées par l'application passent par `withAppCors` :

- `account/password-reset` ;
- `account/verification` ;
- `entitlements/restore` ;
- `payments/sync` ;
- `withdrawal` ;
- les trois routes Google Play.

Le CORS n'est ouvert qu'aux origines de la WebView Capacitor (`https://localhost`, `capacitor://localhost`). `APP_CORS_ORIGINS` en ajoute pour un test.

Le paiement Mollie (`checkout`) et l'administration restent fermés à toute autre origine. Ces écrans répondent 404 dans l'application.

### Configuration Google Play à faire (validation de Christian)

1. Créer les quatre produits ci-dessus (achats uniques), avec les prix recopiés de `editions.ts`, puis les activer.
2. Inviter un compte de service Google Cloud dans la Play Console (Utilisateurs et autorisations).
   - Droits : « Afficher les données financières » et « Gérer les commandes et les abonnements ».
   - Ses identifiants vont dans Vercel (`GOOGLE_PLAY_CLIENT_EMAIL`, `GOOGLE_PLAY_PRIVATE_KEY`), jamais dans le dépôt.
3. Brancher les notifications :
   - créer un sujet Pub/Sub ;
   - donner le droit de publication à `google-play-developer-notifications@system.gserviceaccount.com` ;
   - renseigner le sujet dans Monétisation ;
   - créer un abonnement push vers `https://<serveur>/api/payments/google-play/notify`, avec un compte de service OIDC et une audience ;
   - recopier ce compte et cette audience dans `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT` et `GOOGLE_PLAY_RTDN_AUDIENCE`.
4. Ajouter les testeurs de licence (Paramètres, Test de licence) et créer une piste de test interne. Sans application envoyée sur une piste, Google Play ne renvoie aucun produit.
5. Firebase :
   - application Android `fr.javachrist.geofr`, avec les empreintes SHA-1 de la clé de debug et de la clé d'importation Play ;
   - fournisseur Google activé ;
   - identifiant client OAuth Web dans `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`, au build Android ;
   - publier `firestore.rules`, où la collection `playPurchases` est fermée.

### Variables du serveur pour Google Play

| Variable | Rôle |
| --- | --- |
| `GOOGLE_PLAY_CLIENT_EMAIL`, `GOOGLE_PLAY_PRIVATE_KEY` | Compte de service de l'API Google Play Developer. Secret |
| `GOOGLE_PLAY_RTDN_AUDIENCE`, `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT` | Vérification des notifications Pub/Sub |
| `APP_CORS_ORIGINS` | Origines supplémentaires, pour les tests seulement |

Au build de l'application : `NEXT_PUBLIC_API_BASE_URL` (le serveur) et `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` (public).

### Trois niveaux de test

| Niveau | Ce qu'il prouve | Où |
| --- | --- | --- |
| Local | Règles Play : `assessPlayPurchase`, statuts, notifications, produits | `check:payments`, dans `npm run check` |
| Simulé | Plugin, boutique et appels serveur sur l'émulateur, sans Google Play | APK de debug. Google Play absent ou sans produits : message « paiements indisponibles » |
| Réel (mode test) | Feuille Google Play, testeur de licence, accusé, remboursement depuis la Console | Piste interne et serveur configuré, après validation de Christian |

## iOS (plus tard)

Rien n'est construit pour iOS. Le jour venu :

1. **Capacitor iOS** (`npx cap add ios`) sur le même export statique, avec le même `NEXT_PUBLIC_API_BASE_URL`. L'origine de la WebView (`capacitor://localhost`) est déjà acceptée par `withAppCors`.
2. **Achats** avec StoreKit 2. Les achats intégrés sont obligatoires pour un contenu numérique, jamais Mollie. Les produits sont nommés comme sur Android.
   - Côté serveur, un `PaymentProvider` `app_store` vérifie la transaction signée (JWS) avec l'App Store Server API.
   - Les App Store Server Notifications V2 traitent les remboursements.
   - `appAccountToken` (UUID dérivé du compte) joue le rôle de `obfuscatedAccountId`.
3. **Connexion** : Firebase Auth par e-mail, Google, et « Se connecter avec Apple », que l'App Store exige dès qu'une connexion tierce est proposée.
4. **Publicité** : AdMob et UMP existent sur iOS. Ajouter l'App Tracking Transparency avant toute annonce personnalisée, et remplir l'étiquette de confidentialité de l'App Store.
5. **Règles de l'App Store** : bouton « Restaurer les achats » obligatoire, et suppression du compte possible depuis l'application (règle 5.1.1(v)).
6. **Documents** : ajouter la plateforme iOS dans le Legal Kit, jamais à la main.

## Avant la vente réelle

Rien de ceci n'est fait. Chaque point demande la validation de Christian.

- [ ] Tests de bout en bout en mode test Mollie sur le site déployé, remboursement compris.
- [ ] **Confirmation sur support durable.** Construite : courriel du Mail-Kit après paiement, avec l'édition, le prix, la date, le numéro de commande, l'accès immédiat et les CGV jointes ([courriels.md](courriels.md)). Reste à régler l'envoi SMTP dans Vercel, à la recevoir lors d'un achat de test, et à faire valider son texte par Christian.
- [ ] **Fonction de rétractation en ligne**, obligatoire depuis le 19 juin 2026. Construite : `/retractation` ([retractation.md](retractation.md)). Reste à renseigner `withdrawalAction` dans le Legal Kit après validation, à régénérer et copier les CGV, et à tester le parcours sur le site déployé.
- [ ] **Facturation**, et vendeur selon le canal (points « À COMPLÉTER » des CGV).
- [ ] **Legal Kit.** La version 0.3.2 du kit décrit les comptes (Firebase Authentication), Mollie, Google Play Billing, IONOS et les durées de conservation validées ; elle reste en brouillon tant qu'aucune offre n'est ouverte et que Christian n'a pas rempli `review` (voir [admob.md](admob.md#legal-kit--version-032-brouillon)).
- [ ] Politique du remboursement partiel : droits conservés aujourd'hui.
- [ ] Tarifs de mise à niveau Solo vers Famille, s'ils sont voulus. Aujourd'hui tout second achat est refusé.
- [ ] Projet Firebase : Auth Google et e-mail activés, domaine autorisé, application Android et SHA-1, règles publiées.
- [ ] Google Play : produits, compte de service, RTDN, testeurs de licence et piste interne (voir [Google Play](#configuration-google-play-à-faire-validation-de-christian)). Puis tester en mode test l'achat, le paiement différé, la restauration et le remboursement.
- [x] Web : éditions `active` et clé `live_` acceptée par `mollie.ts` (validation de Christian, 10 novembre 2026).
- [ ] Google Play : passer `PLAY_MODE` à `live` dans `orders.ts` et retirer l'avis « mode test » du canal `play` dans `Shop.tsx`, après la configuration et les tests Play.
