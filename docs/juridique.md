# Documents juridiques

Les cinq documents juridiques de chaque pays viennent de **JavaChrist-Legal-Kit**, et de lui seul. Le jeu n'a aucun autre système juridique : il copie les textes générés par le kit et les affiche.

- Kit : https://github.com/JavaChrist-apps/JavaChrist-Legal-Kit, cloné à côté de ce dépôt (`../JavaChrist-Legal-Kit`).
- À lire avant toute intervention : `CONSIGNES_UTILISATION.md`, `README.md` et `docs/INTEGRATION.md` du kit.
- L'identité juridique de JavaChrist et le médiateur sont dans `config/company.json` du kit. On ne les recopie jamais dans ce dépôt.

## Ce qui est en place

| Élément | Où | Rôle |
| --- | --- | --- |
| Configuration de l'application | Kit, `apps/<id>.json` | Nom, URL, fonctions réellement actives, traitements, prestataires, clauses |
| Catalogue des éditions | Kit, `catalogs/<id>.json` | Éditions payantes et prix en centimes, produits par `scripts/export-catalog.mjs` à partir de `content/<pays>/editions.ts` |
| Documents copiés | `content/<pays>/legal/*.md` | Les cinq documents publics, versionnés dans ce dépôt |
| Trace de la copie | `content/<pays>/legal/legal.json` | Version, mode `draft` ou `reviewed`, empreinte, commit du kit, points restants |
| Lien au pays | `content/<pays>/country.ts`, `legal` | `kitAppId` (identifiant dans le kit) et `supportEmail` |
| Copie | `scripts/sync-legal.mjs` | Copie les cinq `.md` depuis `dist/` du kit. Jamais `rapport.json` ni `snapshot.json` |
| Lecteur | `src/engine/legal-markdown.ts` | Lit le Markdown du kit : titres, paragraphes, listes, tableaux, encadré, liens nus. Aucun HTML interprété |
| Affichage | `src/features/privacy/LegalDocument.tsx` | Une carte par rubrique, une carte par ligne de tableau, lisible sur mobile |
| Contrôles | `scripts/check-content.mjs`, `scripts/check-legal.mjs` | Lancés par `npm run check` |

Pour GéoFR, l'identifiant dans le kit est `geofr`.

## Pages de la rubrique Profil

Les URL existantes sont conservées. Les pages s'ouvrent depuis Profil, puis Confidentialité.

| Document du kit | Page |
| --- | --- |
| `confidentialite.md` | `/profil/confidentialite/politique` |
| `conditions-utilisation.md` | `/profil/confidentialite/conditions` |
| `conditions-vente.md` | `/profil/confidentialite/conditions-de-vente` |
| `mentions-legales.md` | `/profil/confidentialite/mentions-legales` |
| `droits-rgpd.md` | `/profil/confidentialite/droits` |

Les rubriques Consentements, Mes données, Supprimer mes données et Supprimer mon compte restent propres au jeu. Elles agissent sur les données de l'appareil et ne viennent pas du kit.

La correspondance est dans `src/features/privacy/sections.ts`, champ `document`. Elle est commune à tous les pays.

## Sans connexion

Les documents sont lus au moment du build et les pages sont prérendues. Le texte est déjà dans le HTML.

- Application Android (export statique `out/`) : les pages sont dans l'application, lisibles sans connexion.
- Site web : une page déjà ouverte reste lisible. Une page jamais ouverte demande une connexion, car le site n'a pas de service worker.

## Achats

La boutique web, en mode test Mollie, s'appuie sur les CGV du kit. Elle demande deux consentements, jamais cochés d'avance : l'acceptation des CGV, et la demande d'accès immédiat avec le renoncement au droit de rétractation. La commande conserve les deux, avec la version des documents (`legalRelease`) et la date (`orders/{id}.consent`).

Avant toute vente réelle, il reste à faire, avec la validation de Christian :

- la confirmation sur support durable : construite avec JavaChrist-Mail-Kit ([courriels.md](courriels.md)), son texte reste à valider ;
- dans les documents du kit, citer l'envoi des courriels par IONOS parmi les prestataires ;
- la fonction de rétractation en ligne, obligatoire depuis le 19 juin 2026, pas encore construite. Son lien est encore « À COMPLÉTER » dans les CGV ;
- la facturation et le vendeur selon le canal ;
- dans le kit, `apps/geofr.json` : les comptes (`accounts`), Firebase Authentication et Mollie dans les traitements et prestataires, puis régénérer et copier les documents.

Le détail est dans [paiements.md](paiements.md#avant-la-vente-réelle).

## Ajouter ou mettre à jour les documents d'un pays

Exemple avec l'Espagne, identifiant `geoes`. Les commandes du kit se lancent dans le dossier du kit.

### 1. Configuration dans le kit

Copier `apps/geofr.json` vers `apps/geoes.json`, puis adapter :

- `name`, `url`, `supportEmail`, `version`, `effectiveDate` ;
- `features` : seulement ce qui fonctionne vraiment dans le jeu, pas ce qui est prévu ;
- `processing`, `providers`, `hosting` : ce que le code fait réellement ;
- `clauses` : laisser `À COMPLÉTER` ce qui n'est pas connu ;
- `catalog` : `catalogs/geoes.json`, écrit depuis ce dépôt par `node scripts/export-catalog.mjs es`, jamais à la main (voir [editions.md](editions.md)).

Ne pas remplir `review`. Ne pas modifier `config/company.json` ni `templates/` sans nécessité démontrée et l'accord de Christian.

### 2. Générer le brouillon

```bash
npm run generate -- --app geoes
```

```bash
npm test
```

Le brouillon est écrit dans `dist/geoes/<version>-draft/`. Le kit liste les points à compléter dans `rapport.json`.

### 3. Copier dans le jeu

Depuis ce dépôt :

```bash
node scripts/sync-legal.mjs es geoes 0.1.0-draft
```

Le dossier du kit peut être donné avec `--kit <chemin>`. Puis, dans `content/es/country.ts` :

```ts
legal: { kitAppId: "geoes", supportEmail: "support@appsgeo.com" },
```

Lancer `npm run check`. Un brouillon s'affiche avec le bandeau « BROUILLON » du kit.

### 4. Relecture et version validée

Christian lit les cinq documents et complète les points restants. Il renseigne lui-même `review` dans `apps/geoes.json` : `approved`, `reviewer`, `reviewedAt` et `configurationSha256`, l'empreinte affichée par le kit. Puis, dans le kit :

```bash
npm run generate -- --app geoes --publish
```

Et dans ce dépôt :

```bash
node scripts/sync-legal.mjs es geoes 0.1.0-reviewed
```

La version validée n'a plus de bandeau. `--publish` ne publie aucune page et ne déploie rien.

### 5. Nouvelle édition

Pour un prix ou une édition, lancer d'abord `node scripts/export-catalog.mjs <pays>`. Pour toute modification (prix, offre, prestataire, donnée collectée, publicité), incrémenter `version` dans le kit, régénérer, relire, publier, copier.

Une version validée n'est jamais remplacée automatiquement. Si `legal.json` indique `reviewed`, la copie d'une autre version s'arrête, liste les documents qui changeraient et donne la commande `git diff --no-index` pour comparer.

## Règles

- Un seul système juridique : le kit. Aucun texte juridique dans `src/i18n/locales/` ni dans `content/<pays>/locales/`.
- Aucune coordonnée inventée. Une information inconnue reste `À COMPLÉTER` dans le kit.
- Aucun prix inventé, aucune copie à la main. Le catalogue du kit est produit par `scripts/export-catalog.mjs` à partir de `content/<pays>/editions.ts`, et `npm run check` signale tout écart quand le kit est cloné à côté.
- Une offre reste `planned` tant qu'elle n'est pas réellement en vente. Le document affiche alors « Non commercialisée ».
- L'agent ne remplit jamais `review`.
- `rapport.json` et `snapshot.json` ne sont jamais copiés dans le jeu.
- `content/<pays>/legal/` est versionné. Il sert d'archive des textes affichés, car `dist/` du kit n'est pas suivi par Git.

## Contrôles automatiques

`npm run check` vérifie pour chaque pays :

- `legal.kitAppId` et `legal.supportEmail` sont renseignés ;
- `legal.json` existe, son `appId` correspond à `kitAppId`, son mode est `draft` ou `reviewed` ;
- les cinq `.md` existent, ont un titre, ne contiennent ni HTML brut ni variable `{{…}}` non résolue ;
- les mentions légales contiennent `supportEmail` ;
- le lecteur Markdown traite correctement liens, tableaux, listes, encadré et HTML, et chaque document a un seul titre et des tableaux complets.

## État de GéoFR

Version documentaire 0.2.0, en **brouillon**, empreinte `4461cb6e…b409181`. Le kit signale 11 points à compléter. Les documents sont intégrés localement et ne sont pas en production.

### Points à compléter dans le kit

- Hébergeur Vercel : téléphone et régions d'hébergement.
- Journaux d'hébergement Vercel : durée de conservation.
- Transferts hors Union européenne : mécanisme retenu (cadre de protection des données UE–États-Unis ou clauses contractuelles types).
- Facturation et confirmation de commande sur support durable.
- Rétractation : une adresse HTTPS de la fonction en ligne de rétractation.
- Garanties légales : l'encadré attendu.
- Durée de fourniture des mises à jour.
- Effets de la résiliation sur les achats.
- Aucune offre active : normal tant que rien n'est en vente.

### Manques relevés pour GéoFR

- **Découverte gratuite** : les deux régions ne sont pas choisies, et son régime publicitaire n'est pas décidé.
- **Fonction de rétractation en ligne** : obligatoire pour les ventes en ligne à partir du 19 juin 2026. Elle n'existe pas encore dans le jeu.
- **Vendeur selon le canal** : sur Google Play, les conditions et la facturation du store s'ajoutent. À traiter quand l'application Android existera.
- **Publicité et mineurs** : les éditions Solo et Famille avec publicités demanderont `ads: true` dans le kit, un consentement, et une publicité limitée au contexte pour un public mineur. Le module publicitaire du kit devra être relu avant toute mise en service.
- **Export des données** : le jeu permet de voir et d'effacer les données de l'appareil, pas d'en télécharger une copie.
- **Hors connexion sur le web** : pas de service worker, voir plus haut.
- **Autres pays** : les modèles du kit couvrent la France, le français et la vente aux particuliers. Un pays hors de France demande une adaptation des modèles, à valider par Christian avant toute génération.
- **CGV** : non définitives tant qu'aucune offre n'est active.
