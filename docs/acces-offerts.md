# Accès offerts

Une liste d'adresses e-mail tenue par un administrateur. Chaque adresse autorisée reçoit gratuitement l'**Édition Famille complète, sans publicité** de l'application du pays : toutes les régions, tous les niveaux et défis, Solo et Mode Famille, albums et badges, sans vidéo de JavaChrist-Promotions. Commun à tous les pays de la collection.

- Aucun paiement, aucune commande : ni fausse commande Mollie, ni transaction Google Play.
- L'accès dure jusqu'à sa révocation.
- Il vaut pour **une seule application** : un accès GéoFR n'ouvre ni GéoDE ni GéoES.
- Un bénéficiaire n'obtient jamais de droit d'administration.

## Droits effectifs

Les droits d'un compte réunissent deux sources distinctes, calculées par le serveur :

```ts
effectiveEntitlements(computeEntitlements(commandesPayées), accèsOffertActif)
// { fullGameAccess, familyAccess, adsRemoved, editions, granted }
```

- `editions` et `sourceOrderIds` ne viennent que des commandes payées. Un accès offert n'y ajoute rien.
- `granted: true` ouvre `fullGameAccess`, `familyAccess` et `adsRemoved`.
- Une révocation recalcule les droits depuis les commandes : un achat réel reste entier.

Les écrans de jeu ne changent pas. Ils lisent déjà `familyAccess` (Mode Famille), `adsRemoved` (promotions) et `canPlayRegion` (régions).

## Ajouter ou retirer un bénéficiaire

Page `/admin/acces-offerts`, réservée aux administrateurs. Elle répond 404 dans l'export statique (Android).

Le Profil affiche le bouton « Gérer les accès offerts » seulement aux administrateurs : le panneau Compte appelle `POST /api/admin/grants` avec `action: "status"`, qui passe par la même vérification que les autres actions. Pour un compte confirmé qui n'est pas administrateur, cette seule action répond `200` avec `admin: false`, pour ne pas laisser d'erreur 403 dans la console de chaque joueur ; les autres actions gardent leur 403. Ce bouton n'ouvre rien à lui seul : la page et chaque action revérifient l'administrateur côté serveur.

Être administrateur ne donne pas l'accès offert. Pour en profiter, l'administrateur ajoute aussi sa propre adresse à la liste.

| Action | Effet |
| --- | --- |
| Ajouter une adresse | L'adresse est normalisée (espaces retirés, minuscules, Unicode NFC). Une adresse déjà en attente ou active est refusée (`alreadyGranted`). Une adresse révoquée redevient autorisée. |
| Lister | Adresse, statut, date d'ajout, date d'activation ou de révocation, les plus récentes d'abord. |
| Révoquer | Demande une confirmation. Les droits du compte rattaché sont réécrits aussitôt. |

Statuts :

| Statut | Signification |
| --- | --- |
| `pending` (en attente) | Adresse autorisée, aucun compte confirmé ne l'utilise encore. |
| `active` (actif) | Rattaché à un compte (`uid`) dont l'adresse est confirmée. |
| `revoked` (révoqué) | Retiré. Les dates d'ajout et de révocation restent visibles. |

### À la connexion du bénéficiaire

1. L'adresse est ajoutée, avant ou après la création du compte.
2. Si un compte existe déjà avec cette adresse confirmée (ou Google), l'accès devient `active` dès l'ajout.
3. Sinon il reste `pending`. À chaque connexion, `POST /api/entitlements/restore` compare l'adresse du jeton à la liste. Si l'adresse est confirmée, l'accès devient `active` et les droits sont écrits. Le compte n'est jamais recréé.
4. Une adresse non confirmée n'ouvre rien. Dès la confirmation, le jeton est rafraîchi, la restauration repart et l'accès s'active.

L'application suit `entitlements/{app}/users/{uid}` en direct. Une révocation s'applique donc sans nouvelle connexion, et l'accès survit à une déconnexion puis reconnexion.

### Profil et boutique

- Le Profil affiche « Accès GéoFR offert — Édition Famille complète, sans publicité ».
- Le lien vers la boutique est masqué.
- La boutique remplace les offres par la même carte. Le serveur refuse tout achat d'un bénéficiaire actif (`offeredAccess`).

## Administration sécurisée

### Premier administrateur et suivants

Aucune route ne permet de devenir administrateur. Seul `scripts/admin.mjs`, lancé en local par Christian avec un compte de service Firebase Admin, écrit `admins/{uid}`.

Préparation, une seule fois : console Firebase, **Paramètres du projet**, **Comptes de service**, **Générer une nouvelle clé privée**. Ranger le fichier JSON **hors du dépôt**, par exemple `C:\Users\JavaChrist\secrets\geofr-admin.json`. Ne jamais le copier dans le projet ni le partager.

Dans PowerShell :

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\JavaChrist\secrets\geofr-admin.json"
```

```powershell
node scripts/admin.mjs fr add <adresse> --project geofr-d5224
```

```powershell
node scripts/admin.mjs fr list --project geofr-d5224
```

```powershell
node scripts/admin.mjs fr remove <adresse> --project geofr-d5224
```

- Le compte doit exister dans le jeu et avoir une adresse confirmée (ou Google).
- `admins/{uid}.apps` liste les applications administrées (`["geofr"]`). Administrer GéoFR ne donne aucun droit sur GéoDE.
- Projet : `--project`, sinon `FIREBASE_ADMIN_PROJECT_ID`, sinon `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- Identifiants : `GOOGLE_APPLICATION_CREDENTIALS`, ou `FIREBASE_ADMIN_CLIENT_EMAIL` et `FIREBASE_ADMIN_PRIVATE_KEY` comme le serveur. La connexion de `firebase-tools` ne suffit pas.
- Le script n'affiche jamais de clé. Sans identifiants valables, il le dit sans détail technique.

### À chaque appel

`POST /api/admin/grants` (`action` : `list`, `add` ou `revoke`) vérifie le jeton Firebase, exige un compte permanent, puis lit `admins/{uid}` côté serveur. Sinon la réponse est 401 sans compte, ou 403 `forbidden`. L'action `status` répond 401 sans compte, et `200` avec `admin: false` au lieu du 403. L'écran n'ouvre rien à lui seul : il affiche « non autorisé » sur ce refus.

## Règles Firestore

| Chemin | Contenu | Navigateur |
| --- | --- | --- |
| `grants/{app}/emails/{adresse}` | Statut, compte rattaché, auteur et dates d'ajout, d'activation et de révocation, historique | Ni lecture ni écriture |
| `admins/{uid}` | Adresse, `apps` administrées | Ni lecture ni écriture |
| `entitlements/{app}/users/{uid}` | Droits effectifs, dont `granted` | Lecture par le joueur seul |

L'adresse sert d'identifiant du document : un doublon est impossible. La liste n'est jamais lue ni écrite depuis le navigateur, même par un administrateur ou un bénéficiaire. Seul le serveur y accède, avec Firebase Admin.

Les règles de `firestore.rules` se publient avec la commande de [paiements.md](paiements.md#données-firestore), sur accord de Christian.

## Android

Avec le canal `play` (build avec `NEXT_PUBLIC_API_BASE_URL`), l'application connecte le joueur et lit ses droits comme le web :

1. Les droits sont lus dans `entitlements/{app}/users/{uid}`, `granted` compris. La restauration du serveur tourne à chaque connexion et à la confirmation de l'adresse, ce qui active un accès en attente.
2. Si `granted` est vrai, la boutique masque les achats et le bouton de restauration, et le serveur refuse la préparation d'un achat Play (`offeredAccess`). Play Billing n'est jamais lancé.
3. L'accès offert n'est jamais déduit de l'application seule : le serveur reste la seule source.
4. Aucune bannière AdMob ni requête publicitaire. `AdsProvider` lit `granted` et `adsRemoved` dans `useEntitlements()`, et refuse tant que les droits ne sont pas `ready` (`check:ads`, sections 6 et 7).
5. L'administration des accès répond 404 dans l'application.

## Autres pays

Rien à écrire dans `src/`. L'identifiant d'application vient de `legal.kitAppId` dans `content/<pays>/country.ts`. Les listes et les administrateurs sont donc séparés par pays sans configuration. Pour un nouveau pays : nommer un administrateur avec `scripts/admin.mjs <pays> add <adresse>`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/engine/grants.ts` | Statuts, normalisation de l'adresse, règles d'ajout et de révocation |
| `src/engine/entitlements.ts` | `effectiveEntitlements`, refus d'achat `offeredAccess` |
| `src/services/grants.ts` | Vérification de l'administrateur, liste, ajout, révocation |
| `src/services/payments/orders.ts` | Activation à la connexion, recalcul des droits |
| `src/app/api/admin/grants/route.server.ts` | Route d'administration |
| `src/app/admin/acces-offerts/page.tsx`, `src/features/admin/` | Écran d'administration |
| `scripts/admin.mjs` | Création et retrait des administrateurs |
| `scripts/check-grants.mjs` | Tests unitaires, lancés par `npm run check` |
| `scripts/test-payments-emulator.mjs` | Tests d'intégration, `npm run test:payments` |

## Tests

`npm run check:grants` couvre la normalisation, les statuts, la réunion des droits pour chaque pays, l'achat conservé après révocation et le refus d'achat.

`npm run test:payments` couvre, sur les émulateurs :

- administration refusée sans compte, à un joueur, à un administrateur non confirmé ou d'un autre pays ;
- adresse autorisée d'un compte déjà inscrit, sans commande créée ;
- adresse autorisée avant la création du compte ;
- adresse non vérifiée, puis confirmée ;
- adresse non autorisée, et accès d'un autre pays ;
- doublon et adresse invalide refusés ;
- révocation sans nouvelle connexion, puis nouvel ajout ;
- compte avec un achat payant, achat conservé ;
- persistance après déconnexion puis reconnexion ;
- bénéficiaire sans privilège d'administration ;
- règles Firestore fermées sur `grants` et `admins`.
