# Ajouter un pays

Exemple avec l'Espagne, code `es`. Remplace `es` par le code du pays. Aucun secret n'est nécessaire pour les étapes en place.

Les étapes 1 à 14 sont **en place** : elles suffisent à construire le jeu web d'un nouveau pays. Les étapes 15 à 18 sont **prévues** ou demandent la validation de Christian.

## Contenu du pays (en place)

### 1. Choisir le code et créer le dossier

Code de deux lettres minuscules, identique pour le dossier, `GEO_COUNTRY` et `country.code`. Créer `content/es/`.

### 2. Configuration : `content/es/country.ts`

Exporter `country: CountryConfig` (type dans `src/engine/types.ts`) : `code`, `appName`, `androidPackage`, `locales`, `defaultLocale`, `regionCount`, `legal`, `timeZone` (fuseau des dates dans les courriels, par exemple `Europe/Madrid`), `icons`, `themeColor`, `backgroundColor`, `promotions` (catalogue JavaChrist-Promotions du jeu, ou `null`, voir [promotions.md](promotions.md#ajouter-un-pays-géode-géoes)). Partir de `content/fr/country.ts`.

Les tarifs ne vont pas dans `country.ts`. Copier `content/fr/editions.ts` vers `content/es/editions.ts` avec les prix validés par Christian, l'importer dans `content/es/index.ts`, puis lancer `node scripts/export-catalog.mjs es`. Les régions de la Découverte se choisissent dans `regions` de l'édition `discovery`. Voir [editions.md](editions.md). Boutique, droits et verrous sont communs : rien à coder pour le pays (voir [paiements.md](paiements.md)). Les accès offerts aussi : leur liste est séparée par `legal.kitAppId`, il suffit de nommer un administrateur avec `node scripts/admin.mjs es add <adresse> --project <id>` (voir [acces-offerts.md](acces-offerts.md)).

### 3. Documents juridiques

Les cinq documents juridiques viennent de JavaChrist-Legal-Kit, jamais d'un texte écrit dans ce dépôt. Créer `apps/<id>.json` dans le kit, y écrire le catalogue avec `node scripts/export-catalog.mjs es`, générer le brouillon, puis le copier avec `node scripts/sync-legal.mjs es <id> 0.1.0-draft`. Renseigner `legal: { kitAppId, supportEmail }` dans `country.ts`. Toute la procédure, les règles et la relecture par Christian sont dans [juridique.md](juridique.md).

Les modèles de courriel viennent de même de JavaChrist-Mail-Kit : créer `apps/<id>.json` dans le Mail-Kit, puis lancer `node scripts/sync-mail.mjs es <id>`. Voir [courriels.md](courriels.md).

### 4. Carte nationale

Écrire `content/es/map.config.json` : source GeoJSON avec son URL et son empreinte SHA-256, projection, propriété d'identifiant, correspondance des régions. Puis :

```bash
node scripts/build-map.mjs es
```

Le fichier `content/es/map.json` produit est versionné.

### 5. Cartes des défis

Écrire `content/es/game-maps.config.json`, une entrée par carte, puis :

```bash
node scripts/build-game-maps.mjs es
```

Les fichiers `content/es/maps/*.json` produits sont versionnés.

### 6. Régions : `content/es/regions/*.json`

Un fichier par région, avec son statut `draft` ou `published`. Leur nombre doit égaler `regionCount`.

### 7. Parcours : `content/es/territories/*.json`

Niveaux, questions, indices, anecdotes, groupes, difficultés 1 à 3, lieux, cartes souvenirs, badges. Un parcours reste en `draft` tant qu'il n'est pas relu.

### 8. Sources

Un fichier de relecture par parcours dans `docs/sources-<parcours>.md`, sur le modèle de `docs/sources-alsace-bienvenue.md`. Chaque bonne réponse et chaque fait d'anecdote est sourcé. Ce qui est rédigé par nous est signalé comme tel.

### 9. Photos et crédits

Les photos vont dans `public/media/es/`, chacune créditée dans `content/es/media/credits.json` : auteur, licence, lien. Jamais d'image inventée ou générée pour représenter un lieu réel.

### 10. Textes de contenu : `content/es/locales/<langue>.json`

Noms des régions, des parcours, des niveaux, des thèmes. **Aucun bloc de tête ne doit porter le nom d'un bloc de `src/i18n/locales/<langue>.json`**, sinon il effacerait l'interface. `check:content` refuse ce cas.

### 11. Mode Famille : `content/es/family.ts`

Exporter `family: FamilyContent` : la liste des thèmes, chacun avec un `id`, une `nameKey` dans le bloc `familyScopes` et les catégories de questions qu'il regroupe. Le fichier est obligatoire, même avec une liste vide. Ajouter `familyScopes.wholeCountry` et `familyScopes.wholeCountryNote` aux textes de contenu.

### 12. Assemblage : `content/es/index.ts`

Importer tout ce qui précède et exporter un `CountryContent` par défaut, sur le modèle de `content/fr/index.ts`.

### 13. Langue de l'interface

Si le pays utilise une langue sans fichier dans `src/i18n/locales/`, traduire `src/i18n/locales/fr.json` dans `src/i18n/locales/<langue>.json`, avec exactement les mêmes clés. Aucun nouveau système de traduction.

### 14. Contrôles et build

```bash
npm run check
```

`check:content` et `check:family` parcourent automatiquement chaque dossier de `content/` qui ne commence pas par `_`.

Sous Git Bash :

```bash
GEO_COUNTRY=es npm run build
```

Sous PowerShell :

```powershell
$env:GEO_COUNTRY="es"; npm run build
```

Puis, pour Capacitor, la même chose avec `npm run build:export`.

## Publication (prévu, avec validation)

### 15. Icônes et fichiers publics

Aujourd'hui, les icônes sont à la racine de `public/` et servent à GéoFR. Un deuxième pays demande soit des icônes par pays, soit un build qui copie les siennes. **Prévu**, à décider au premier pays suivant.

### 16. Projet Vercel du pays

Un projet Vercel par pays, sur le même dépôt GitHub, avec la variable `GEO_COUNTRY=es`. **Prévu**, à créer uniquement avec la validation de Christian.

### 17. Projet Firebase du pays

Un projet Firebase par pays. **Prévu** : aucun code Firebase n'existe encore. Il passera par `src/services/` uniquement, et aucune clé Admin ne sera exposée au navigateur.

### 18. Application Android

Capacitor sur l'export `out/`. **En place pour les tests** : `content/<pays>/android.json` (identifiant d'application, nom, ID d'application AdMob de démonstration) et `ads` dans `country.ts`, puis `GEO_COUNTRY=<pays> npm run build:export` et `npx cap sync android`. Voir [admob.md](admob.md#ajouter-un-pays-géode-géoes-géoit). Publication Play et identifiants réels : validation de Christian. Pour les envois en test interne, ajouter `content/<pays>/play-release.json` (voir [play-release.md](play-release.md)).

## Limites à connaître

- `tsconfig.json` fait pointer `@country` vers le contenu français : `npm run typecheck` ne vérifie que les types de la France. Le contenu des autres pays est validé par `check:content`.
- Une partie des tests de `scripts/check-family.mjs` (parties simulées) utilise le contenu français comme jeu d'essai. Les tests de tirage, eux, tournent sur chaque pays.
