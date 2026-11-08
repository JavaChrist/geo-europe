# Architecture

## Principe

Un dépôt GitHub commun, un projet Vercel et un projet Firebase indépendants pour chaque pays.

Le code est écrit une fois. Chaque pays apporte son contenu dans `content/<pays>/`, et le pays est choisi au moment du build par la variable `GEO_COUNTRY`, `fr` par défaut.

| Élément | État |
| --- | --- |
| Dépôt GitHub commun | En place |
| Projet Vercel de GéoFR, déployé à chaque push sur `main` | En place |
| Un projet Vercel par pays suivant | Prévu, à créer avec la validation de Christian |
| Un projet Firebase par pays | Prévu. Aucun code Firebase n'existe encore dans le dépôt |
| Application Android via Capacitor | Prévu. L'export statique `out/` est prêt, Capacitor n'est pas installé |

## Dossiers

| Dossier | Rôle | Règle |
| --- | --- | --- |
| `src/engine/` | Types et logique du jeu : parcours, tirage des questions, album, défis, Mode Famille | Aucun import React, Next, Firebase ou interface. Lancé directement par Node dans les scripts de contrôle |
| `src/features/` | Écrans : `explorer`, `journey`, `album`, `family`, `privacy`, `reset`, `update`, `demo` | Pas de code propre à un pays |
| `src/ui/` | Composants communs : en-tête, barre du bas, cartes, modales | Pas de texte en dur |
| `src/services/` | Stockage local, version, erreurs (`AppError`), frontières d'accès | Seul endroit autorisé à importer Firebase, le jour où il arrivera |
| `src/i18n/` | Traducteur et textes de l'interface (`src/i18n/locales/<langue>.json`) | Textes communs à tous les pays |
| `src/app/` | Routes Next.js | Les routes serveur s'appellent `route.server.ts` |
| `content/<pays>/` | Configuration, régions, parcours, cartes, crédits photo, textes de contenu, thèmes Famille, éditions et tarifs (`editions.ts`), documents juridiques copiés du kit (`legal/`) | Tout ce qui est propre au pays |
| `public/media/<pays>/` | Photos du pays, créditées dans `content/<pays>/media/credits.json` | Pas d'image inventée pour un lieu réel |
| `scripts/` | Génération des cartes et contrôles | Lancés par `npm run check` ou à la main |

## Choix du pays au build

`next.config.ts` lit `GEO_COUNTRY`, vérifie que `content/<pays>/index.ts` existe, puis fait pointer l'alias `@country` vers ce fichier. Le code importe toujours le contenu par `import content from "@country"`.

Limite connue : dans `tsconfig.json`, l'alias `@country` pointe en dur vers `content/fr/index.ts`. Le build d'un autre pays fonctionne, mais `npm run typecheck` vérifie les types avec le contenu français. Le contenu des autres pays est validé par `check:content`.

## Textes

- `t("clé")` pour l'interface, depuis `src/i18n/locales/<langue>.json`. Les clés sont typées à partir du fichier français.
- `tContent("clé")` pour le contenu, depuis `content/<pays>/locales/<langue>.json`.
- Les deux fichiers sont fusionnés **au premier niveau seulement**. Un bloc de tête du contenu qui porterait le même nom qu'un bloc de l'interface l'effacerait. `check:content` refuse ce cas depuis le lot Mode Famille. C'est pour cela que les thèmes Famille vivent dans le bloc `familyScopes` et non `family`.
- Les pluriels utilisent un objet `{ "one": "…", "other": "…" }` et la variable `count`.

## Données du joueur

Tout est stocké sur l'appareil, dans `localStorage`, par pays :

| Clé | Contenu | Fichier |
| --- | --- | --- |
| `geo-europe.<pays>.progress` | Progression Solo, XP, cartes souvenirs, défis | `src/services/local-progress.ts` |
| `geo-europe.<pays>.family` | Joueurs, historique et partie en cours du Mode Famille | `src/services/family-storage.ts` |
| `geo-europe.<pays>.promotions` | Compteur de parties, dernière vidéo vue, réponse à la question d'âge, copie du catalogue | `src/services/promotions.ts` |

Les trois sont séparés : le Mode Famille ne touche jamais la progression Solo. L'écran Confidentialité permet de tout effacer. Voir [promotions.md](promotions.md).

## Build et déploiement

| Commande | Résultat |
| --- | --- |
| `npm run build` | Build web avec les routes serveur, pour Vercel |
| `npm run build:export` | Export statique dans `out/`, sans route serveur, pour Capacitor. La détection de mise à jour y est coupée |
| `node scripts/build-map.mjs <pays>` | Régénère `content/<pays>/map.json` depuis `map.config.json`. Le résultat est versionné |
| `node scripts/build-game-maps.mjs <pays>` | Régénère `content/<pays>/maps/*.json` depuis `game-maps.config.json`. Le résultat est versionné |

Les sources des cartes sont téléchargées et vérifiées par leur empreinte SHA-256. L'application ne dépend d'aucun outil cartographique à l'exécution.

## Accès payants

L'achat web passe par Mollie, en mode test uniquement, avec un compte Firebase Authentication. Les droits sont écrits par le serveur dans Firestore, jamais à partir d'un résultat du navigateur. Tous les verrous lisent une seule couche, `useEntitlements()`, et la clé Firebase Admin n'existe que dans les routes `route.server.ts`. L'export Android n'a ni boutique ni connexion. Voir [paiements.md](paiements.md).
