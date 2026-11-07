# Paiements et droits d'accès

Achat web des éditions par Mollie, droits d'accès vérifiés par le serveur. Commun à tous les pays de la collection.

**État : mode test uniquement.** Aucun encaissement public. Le serveur refuse toute clé Mollie qui ne commence pas par `test_`, et toutes les éditions restent `planned`. Passer en vente réelle demande la validation de Christian (voir [Avant la vente réelle](#avant-la-vente-réelle)).

## Droits

| Édition | Régions | Niveaux, défis Solo, album | Mode Famille | Sans publicités ni promotions |
| --- | --- | --- | --- | --- |
| Découverte gratuite, sans compte | Celles de `regions` dans `editions.ts` (GéoFR : Île-de-France, Occitanie) | Dans ces régions | Non | Non |
| `solo_ads` | Toutes | Oui | Non | Non |
| `solo_no_ads` | Toutes | Oui | Non | Oui |
| `family_ads` | Toutes | Oui | Oui | Non |
| `family_no_ads` | Toutes | Oui | Oui | Oui |

La carte de France reste consultable par tous. La progression reste sur l'appareil, avec ou sans compte : se connecter ne l'efface pas.

Les droits sont calculés par `computeEntitlements()` (`src/engine/entitlements.ts`) à partir des seules commandes payées :

```ts
{ fullGameAccess, familyAccess, adsRemoved, editions }
```

Un même calcul sert à la notification, à la restauration et au rattrapage.

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

`GET /api/payments/reconcile` relit chez Mollie les commandes en cours et les commandes payées depuis moins de 180 jours (remboursement ou contestation tardifs), et corrige les droits si une notification a été perdue. La route exige l'en-tête `Authorization: Bearer <CRON_SECRET>`, que Vercel Cron envoie de lui-même. La tâche est déclarée dans `vercel.json`, une fois par jour, ce que permet l'offre Hobby.

### Restauration

Il y a deux façons de retrouver ses droits :

- se connecter sur un autre appareil : les droits sont lus dans Firestore ;
- le bouton « Restaurer mes achats » du Profil (`POST /api/entitlements/restore`) : les droits sont recalculés depuis les commandes.

## Données Firestore

| Chemin | Contenu | Écrit par |
| --- | --- | --- |
| `orders/{id}` | Compte, application, édition, montant et devise lus par le serveur, mode, statut, paiement Mollie, remboursements, consentements avec version des CGV et date, historique | Serveur uniquement |
| `entitlements/{app}/users/{uid}` | Droits calculés, commandes sources, date | Serveur uniquement |

`firestore.rules` permet seulement à un joueur connecté de lire ses propres droits et commandes. Toute écriture depuis le navigateur est refusée. Le serveur écrit avec Firebase Admin, qui n'existe que dans les routes `route.server.ts`.

Les règles se publient avec la commande suivante :

```bash
npx firebase-tools deploy --only firestore:rules --project geofr-d5224
```

### Sans réseau ni Firebase

`EntitlementsProvider` (`src/features/account/`) donne à toute l'application une seule couche de droits. Son état est `loading`, `ready` ou `offline`, et `enabled` dit si les paiements existent dans ce build.

- Sans Firebase configuré, ou dans l'export Android, la Découverte gratuite s'ouvre.
- Hors ligne ou en cas d'erreur, seuls les droits déjà reçus de Firestore pendant la session servent. Aucun droit n'est lu dans le stockage local. Sans eux, seule la Découverte s'ouvre, et le Profil le signale.

Les verrous sont `RegionGate` (layout `src/app/explorer/[slug]/layout.tsx`, qui couvre parcours, niveaux et défis) et la carte de verrou du Mode Famille. Rien n'est jamais ouvert sur la seule foi du navigateur pour une édition payante.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/engine/entitlements.ts` | Droits, Découverte, refus d'un second achat, `productIdOf` |
| `src/engine/payments.ts` | Montants, contrôle d'un paiement relu, transitions de statut, interface `PaymentProvider` |
| `src/services/firebase/client.ts` | Firebase navigateur : Auth, lecture Firestore, émulateurs |
| `src/services/firebase/admin.ts` | Firebase Admin, serveur uniquement |
| `src/services/payments/mollie.ts` | Fournisseur Mollie, clé de test exigée |
| `src/services/payments/orders.ts` | Commandes, notification, synchronisation, restauration, rattrapage |
| `src/services/account.ts` | Connexion, lecture des droits, appels aux routes |
| `src/app/api/payments/*/route.server.ts` | `checkout`, `webhook`, `sync`, `reconcile` |
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
| `MOLLIE_API_KEY` | Serveur | Clé Mollie. `test_…` obligatoire. Secret |
| `APP_BASE_URL` | Serveur | Adresse du site, pour l'URL de retour |
| `PAYMENTS_WEBHOOK_BASE_URL` | Serveur | Adresse publique joignable par Mollie, pour l'URL de notification |
| `CRON_SECRET` | Serveur | Au moins 16 caractères, protège le rattrapage. Secret |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_REPLY_TO` | Serveur | Envoi des courriels, voir [courriels.md](courriels.md). `SMTP_PASSWORD` est secret |

`NEXT_PUBLIC_PAYMENTS` est fixé par `next.config.ts` : `off` dans l'export statique.

## Tests

`npm run check` lance `check:payments`, qui couvre :

- le calcul des droits ;
- la Découverte ;
- le refus d'un second achat ;
- les montants ;
- les contrôles d'un paiement ;
- les transitions de statut.

`npm run test:payments` lance les émulateurs Auth et Firestore, un faux Mollie local en HTTPS, un faux serveur SMTP et le serveur Next. Il faut d'abord lancer `npm run build`, puis Java pour l'émulateur Firestore. Il couvre 25 scénarios :

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
- règles Firestore.

Sous Windows, si l'émulateur Firestore échoue avec « Unable to establish loopback connection », donner à Java un dossier temporaire court sans accent :

```bash
TMP='C:\tmp\geofr' TEMP='C:\tmp\geofr' JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:\tmp\geofr -Djava.io.tmpdir=C:\tmp\geofr' npm run test:payments
```

Ces tests n'atteignent pas la vraie page Mollie. Un achat de bout en bout en mode test se fait sur le site déployé, avec la clé `test_` de Christian, en choisissant « Paid », « Failed », « Canceled » ou « Expired » sur la page de test de Mollie. Il faut aussi tester un remboursement depuis le tableau de bord Mollie.

## Android et autres fournisseurs

L'application Android ne propose jamais Mollie. Google Play impose sa propre facturation pour un contenu numérique. L'export statique coupe la boutique et la connexion (`NEXT_PUBLIC_PAYMENTS=off`), et ne contient aucune route serveur.

Pour ajouter Google Play Billing :

1. Implémenter `PaymentProvider` (`src/engine/payments.ts`) côté serveur, avec `id: "google_play"`. `fetchPayment` y vérifie l'achat avec l'API Google Play Developer, côté serveur uniquement.
2. Utiliser `productIdOf(appId, editionId)` pour les produits Play : `geofr_solo_ads`, `geofr_solo_no_ads`, `geofr_family_ads`, `geofr_family_no_ads`.
3. Écrire la commande dans `orders/{id}` avec `provider: "google_play"`. Les droits restent calculés par `computeEntitlements()` : un achat web et un achat Play donnent les mêmes droits, et la règle d'un seul achat vaut pour tous les canaux.
4. Ne jamais ouvrir un droit sur la seule réponse de l'application. Le jeton d'achat est vérifié par le serveur.

## Avant la vente réelle

Rien de ceci n'est fait. Chaque point demande la validation de Christian.

- [ ] Tests de bout en bout en mode test Mollie sur le site déployé, remboursement compris.
- [ ] **Confirmation sur support durable.** Construite : courriel du Mail-Kit après paiement, avec l'édition, le prix, la date, le numéro de commande, l'accès immédiat et les CGV jointes ([courriels.md](courriels.md)). Reste à régler l'envoi SMTP dans Vercel, à la recevoir lors d'un achat de test, et à faire valider son texte par Christian.
- [ ] **Fonction de rétractation en ligne**, obligatoire depuis le 19 juin 2026. Elle n'est pas encore construite, et les CGV portent encore « À COMPLÉTER » pour son lien.
- [ ] **Facturation**, et vendeur selon le canal (points « À COMPLÉTER » des CGV).
- [ ] **Legal Kit.** `apps/geofr.json` déclare encore `accounts: false`, et ne cite ni Firebase Authentication ni Mollie parmi les traitements et prestataires. La configuration est à mettre à jour dans le kit, puis les documents sont à régénérer et à copier. Christian relit et remplit `review` lui-même.
- [ ] Politique du remboursement partiel : droits conservés aujourd'hui.
- [ ] Tarifs de mise à niveau Solo vers Famille, s'ils sont voulus. Aujourd'hui tout second achat est refusé.
- [ ] Projet Firebase : Auth Google et e-mail activés, domaine autorisé, règles publiées.
- [ ] Passage des éditions à `active`, puis clé `live_`. Le contrôle `test_` de `mollie.ts` se lève alors avec cette validation.
