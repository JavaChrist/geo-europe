# Éditions et tarifs

Chaque pays de la collection propose les mêmes cinq éditions. Leurs prix vivent dans un seul fichier : `content/<pays>/editions.ts`. Aucun autre fichier du dépôt ne contient de tarif.

Rien n'est en vente au public. La boutique web fonctionne en mode test Mollie uniquement, et aucun produit Google Play n'existe. Hors Découverte, les régions et le Mode Famille demandent une édition payante, vérifiée par le serveur. Voir [paiements.md](paiements.md).

## Grille de GéoFR

Prix TTC, achats uniques, aucun abonnement.

| Identifiant | Édition | Prix | Contenu prévu | État |
| --- | --- | ---: | --- | --- |
| `discovery` | Découverte gratuite | 0 € | 2 régions | Prévu |
| `solo_ads` | Solo complet avec publicités | 9,99 € | Toutes les régions, en solo | Prévu |
| `solo_no_ads` | Solo complet sans publicités | 14,99 € | Toutes les régions, en solo | Prévu |
| `family_ads` | Famille complète avec publicités | 14,99 € | Toutes les régions, Mode Famille | Prévu |
| `family_no_ads` | Famille complète sans publicités | 19,99 € | Toutes les régions, Mode Famille | Prévu |

La Découverte ouvre l'Île-de-France et l'Occitanie (`regions: ["FR-IDF", "FR-OCC"]`), sans compte. Son régime publicitaire n'est pas décidé (`ads: null`) ; en attendant, elle affiche les vidéos de promotion comme les éditions avec publicités (voir [promotions.md](promotions.md#éditions-sans-publicités)). Un compte possède au plus une édition payante : aucun tarif de mise à niveau n'existe.

## Où vivent les données

| Élément | Fichier | Rôle |
| --- | --- | --- |
| Types | `src/engine/types.ts`, `Edition` et `EditionsConfig` | Communs à tous les pays |
| Logique | `src/engine/editions.ts` | Liste des identifiants, recherche, contrôle de la grille, conversion en catalogue du kit |
| Prix du pays | `content/<pays>/editions.ts` | Devise, canaux prévus, les cinq éditions |
| Noms et descriptions | `src/i18n/locales/<langue>.json`, bloc `editions` | Communs à tous les pays, `{appName}` remplacé par le nom du jeu |
| Catalogue juridique | Kit, `catalogs/<id>.json` | Produit par `scripts/export-catalog.mjs`, jamais tapé à la main |

Le code lit une édition par `findEdition(content.editions, "solo_no_ads")` et formate son prix par `formatPrice(edition.priceCents, content.editions.currency)`. La boutique `/boutique` les affiche, et le serveur relit le prix dans ce même fichier au moment de la commande.

## Règles

- Un tarif ne s'écrit que dans `content/<pays>/editions.ts`, en centimes TTC.
- Achat unique (`one_time`) ou gratuit (`free`), jamais d'abonnement.
- Une seule édition gratuite, à 0 €. Un achat unique a toujours un prix.
- Toutes les éditions restent `planned`. Passer une édition à `active` demande la validation de Christian, avec les paiements, l'accès vérifié par le serveur et les documents juridiques relus.
- Une édition payante doit avoir un régime publicitaire décidé (`ads` à `true` ou `false`).
- Les noms et descriptions sont dans les textes de l'interface, jamais en dur.

`npm run check` vérifie ces règles pour chaque pays. Si le kit est cloné à côté du dépôt, il vérifie aussi que `catalogs/<id>.json` est la copie exacte de la grille.

## Changer un prix ou une édition

1. Modifier `content/<pays>/editions.ts`, et les textes `editions` si le contenu change.
2. Écrire le catalogue dans le kit :

```bash
node scripts/export-catalog.mjs fr
```

3. Dans le kit, incrémenter `version` dans `apps/<id>.json`, puis régénérer et copier les documents, comme décrit dans [juridique.md](juridique.md).
4. Mettre à jour le tableau de ce document.

Seules les éditions payantes vont au catalogue du kit, qui alimente les CGV. La Découverte gratuite est décrite dans la description de l'application, reprise par les CGU.

## Nouveau pays

Copier `content/fr/editions.ts` vers `content/<pays>/editions.ts`, adapter la devise et les prix validés par Christian, garder les cinq identifiants. Importer `editions` dans `content/<pays>/index.ts`. Puis exporter le catalogue vers le kit.
