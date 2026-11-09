# Promotions JavaChrist

Courtes vidéos qui présentent les autres applications de JavaChrist (SousPli, RideCloud…), montrées entre deux parties. Les campagnes sont gérées dans **JavaChrist-Promotions** et publiées dans le projet Firebase **`motissimo-456ba`**, celui de Motissimo, pas celui de GéoFR.

**État : en place dans le code, catalogue `geofr` pas encore publié.** Tant que Christian n'a pas fait les deux étapes de [Publier les campagnes pour GéoFR](#publier-les-campagnes-pour-géofr), le catalogue répond 404 et aucune vidéo n'apparaît.

## Vue d'ensemble

```
JavaChrist-Promotions (admin)
  └─ publie public_catalogs/<sourceAppId>   Firestore motissimo-456ba, lecture publique
       └─ vidéos dans campaigns/…            Storage motissimo-456ba, lecture publique
GéoFR (navigateur)
  └─ lit le catalogue par l'API REST Firestore, sans SDK, sans clé, sans compte
  └─ lit la vidéo directement depuis Storage (aucune copie dans ce dépôt)
```

Le jeu ne fait que **lire**. Il n'envoie rien au gestionnaire : ni compteur, ni clic, ni identifiant.

| Fichier | Rôle |
| --- | --- |
| `src/engine/promotions.ts` | Types, conversion REST, contrôle des campagnes, tirage, fréquence, droits. Sans React ni Firebase |
| `src/services/promotions.ts` | Lecture du catalogue avec cache, état sur l'appareil |
| `src/features/promotions/usePromotion.tsx` | Décide quand montrer quoi, rend la question d'âge ou la vidéo |
| `src/features/promotions/PromoPlayer.tsx` | Lecteur vidéo |
| `src/features/promotions/AgeQuestion.tsx` | Question d'âge, posée une fois |
| `src/ui/modal/ModalProvider.tsx` | `useModalBusy()` : la vidéo attend la fermeture des modales |
| `scripts/check-promotions.mjs` | Contrôle du moteur, lancé par `npm run check` |
| `content/<pays>/country.ts` | Champ `promotions` du pays |

## Connexion au gestionnaire

Dans `content/fr/country.ts` :

```ts
promotions: { catalogProjectId: "motissimo-456ba", sourceAppId: "geofr", locale: "fr" },
```

- `catalogProjectId` : projet Firebase qui héberge les catalogues. Le même pour toute la collection.
- `sourceAppId` : identifiant du jeu **source** dans JavaChrist-Promotions, c'est-à-dire l'application qui affiche les vidéos. Pour GéoFR : `geofr`. C'est aussi le nom du document du catalogue.
- `locale` : seules les campagnes de cette langue sont gardées.
- `promotions: null` coupe tout pour un pays : aucune requête, aucune question.

URL lue :

```
https://firestore.googleapis.com/v1/projects/motissimo-456ba/databases/(default)/documents/public_catalogs/geofr
```

Aucune clé d'API n'est nécessaire : la règle Firestore autorise la lecture publique de `public_catalogs`. La requête part sans cookie (`credentials: "omit"`), sans référent, et s'arrête au bout de 3 s.

## Structure du catalogue

Document `public_catalogs/<sourceAppId>`, produit par JavaChrist-Promotions :

| Champ | Type | Usage dans GéoFR |
| --- | --- | --- |
| `sourceAppId` | texte | Ignoré (le nom du document suffit) |
| `schemaVersion` | entier | Ignoré |
| `catalogVersion` | entier | Ignoré |
| `generatedAt` | date | Ignoré |
| `campaigns` | liste | Campagnes publiées pour ce jeu |

Chaque campagne :

| Champ | Type | Contrôle |
| --- | --- | --- |
| `id` | texte | Non vide, unique (les doublons sont écartés) |
| `name` | texte | Non vide, affiché dans le bandeau et le bouton |
| `audience` | texte | Doit valoir `adult` |
| `locale` | texte | Doit valoir la `locale` du pays |
| `videoUrl` | texte | `https://` obligatoire |
| `durationMs` | entier | Entre 1 et 15 000 |
| `destinationUrl` | texte | `https://play.google.com/…` obligatoire |
| `weight` | entier | Poids du tirage, au moins 1 |
| `startsAt`, `endsAt` | date ISO ou vide | La campagne n'est gardée qu'entre ces dates |

Une campagne qui ne passe pas un contrôle est ignorée, sans erreur pour le joueur. Le catalogue ne contient ni brouillon, ni statut, ni compte administrateur : ces données restent dans les collections privées du gestionnaire (`campaigns`, `apps`, `admins`), dont la lecture anonyme répond 403.

La conversion du format REST (`stringValue`, `integerValue`, `arrayValue`, `mapValue`…) en objets typés est faite par `fromFirestoreValue` dans le moteur.

### Cache

Le catalogue converti est gardé sur l'appareil dans `geo-europe.<pays>.promotions` :

- moins de 15 min : utilisé sans requête ;
- au-delà : relu ; en cas d'échec réseau, la copie sert encore jusqu'à 1 h ;
- au-delà d'1 h sans réseau : aucune campagne, aucune vidéo ;
- chaque campagne en cache est recontrôlée (dates, durée, adresses) avant usage ;
- le catalogue n'est lu qu'après une réponse « 18 ans ou plus », et il est effacé si la réponse devient « moins de 18 ans ».

## Format vidéo

À respecter dans JavaChrist-Promotions, rien n'est converti côté jeu :

- MP4 (H.264 + AAC), **vertical 9:16**, par exemple 1080 × 1920 ;
- **15 s au maximum** : une campagne plus longue est refusée par le jeu ;
- 10 Mio au plus, pour un démarrage rapide sur mobile (`moov` en tête du fichier, « fast start ») ;
- le message doit se comprendre **sans le son** : la lecture démarre muette ;
- aucune copie de la vidéo dans ce dépôt.

## Lecteur

- Plein écran, dans un `<dialog>` natif, aux couleurs de GéoFR. Aucune alerte du navigateur.
- Lecture automatique **muette** (`muted`, `playsInline`). Si le navigateur la refuse, un bouton « Lancer la vidéo » apparaît.
- Bouton du son, facultatif.
- Bouton « Découvrir <nom> » : ouvre `destinationUrl` dans un nouvel onglet (`noopener,noreferrer`).
- Le **X** apparaît à la fin de la vidéo, ou à 15 s au plus (`min(15 s, durationMs)`).
- Fermeture de secours, le X apparaît aussi :
  - si la vidéo ne peut pas être lue (erreur réseau, format) : un message le dit ;
  - si aucune image n'arrive au bout de 6 s ;
  - au bout de 20 s quoi qu'il arrive ;
  - si l'application passe en arrière-plan (la vidéo est mise en pause).
- Échap ou le bouton retour sont bloqués tant que le X n'est pas visible. Exception de la plateforme : Chrome peut quand même laisser Échap fermer la vidéo si le joueur n'a pas encore touché la page (règle CloseWatcher). C'est accepté : la vidéo se ferme proprement et le compteur reste remis à zéro.
- Pendant la vidéo, la modale de mise à jour attend (`useHoldUpdate`).

## Fréquence

| Règle | Comment |
| --- | --- |
| Après 3 parties terminées | Compteur sur l'appareil, partagé entre Solo, défis et Famille |
| Partie terminée = | Un niveau Solo terminé, un défi spécial terminé, ou une partie Famille arrivée au classement final |
| Ne compte pas | Une question seule, une partie quittée, un rechargement de page |
| Jamais pendant une partie | `usePromotion(playing)` : rien ne s'ouvre tant qu'une partie est en cours |
| Après les récompenses | La vidéo attend que les modales (cartes, badges) soient fermées, puis 1,5 s |
| Mode Famille | Seulement sur l'écran final ou l'accueil du mode, jamais entre deux tours ni sur les résumés de manche |
| Pas deux fois la même | La dernière vidéo vue est écartée du tirage quand une autre existe |
| Sans campagne | Catalogue vide ou réseau absent : rien ne s'affiche, la vidéo sera proposée après la partie suivante |

Un rechargement ne compte jamais : une partie Solo n'est pas sauvegardée en cours, et une partie Famille n'est comptée qu'une fois, au passage en phase `finished`.

## Brancher un écran de jeu

Trois écrans sont branchés : `src/features/journey/LevelGame.tsx` (niveau Solo), `src/features/journey/SpecialChallengeGame.tsx` (défi spécial) et `src/features/family/FamilyMode.tsx`. Un nouvel écran de jeu suit le même modèle :

```tsx
const promotion = usePromotion(partieEnCours);

// Une seule fois, quand la partie est réellement terminée,
// après l'enregistrement du résultat et l'ouverture des modales de récompense.
promotion.gameCompleted();

// Dans le rendu, sur un écran affiché hors partie :
{promotion.overlay}
```

- `partieEnCours` : vrai pendant toute la partie. Exemples : `run !== null` en Solo, `game !== null && game.phase !== "finished"` en Famille.
- `gameCompleted()` ne doit jamais être appelé pour une partie quittée, ni au chargement de la page.
- `overlay` vaut `null` la plupart du temps. En Famille, il n'est rendu que sur l'accueil du mode et sur l'écran final.
- Appeler `usePromotion` avant tout retour anticipé du composant (règles des hooks).
- L'attente des modales repose sur `useModalBusy()` (`src/ui/modal/ModalProvider.tsx`) : vrai tant qu'une modale `useModal()` est ouverte ou en file. Tout écran qui doit passer après les modales peut s'en servir.

## Éditions sans publicités

Les promotions sont des publicités : elles suivent `adsRemoved` de `useEntitlements()`, calculé par le serveur. Aucun autre système de droits.

| Édition | Vidéos | Question d'âge | Requête du catalogue |
| --- | --- | --- | --- |
| Découverte gratuite, sans compte | Oui | Oui | Oui |
| `solo_ads` (9,99 €) | Oui | Oui | Oui |
| `family_ads` (14,99 €) | Oui | Oui | Oui |
| `solo_no_ads` (14,99 €) | Non | Non | Non |
| `family_no_ads` (19,99 €) | Non | Non | Non |

Tant que les droits se chargent (`status: "loading"`), rien n'est affiché ni demandé. Les droits sont relus au moment d'ouvrir la vidéo : un achat sans publicités pendant l'attente annule tout.

## Âge

Les campagnes publiées sont réservées aux adultes (`audience: "adult"`). Avant la première vidéo, le jeu demande une fois « Avez-vous 18 ans ou plus ? » :

- deux réponses de même poids, rien n'est coché d'avance ;
- « Plus tard » ou Échap : pas de réponse, la question reviendra après 3 autres parties ;
- « J'ai moins de 18 ans » : plus aucune vidéo ni requête sur cet appareil ;
- la réponse reste sur l'appareil, et s'efface depuis Confidentialité avec les résultats.

## Données sur l'appareil

`geo-europe.<pays>.promotions`, version 1 :

```json
{ "version": 1, "state": { "completedSinceLast": 0, "lastShownId": null, "adult": null }, "catalog": null }
```

Aucune donnée personnelle n'est envoyée. L'écran Confidentialité efface cette clé avec les résultats.

## Règles de sécurité (projet `motissimo-456ba`)

Les règles sont **dans le dépôt Motissimo** (`firestore.rules`, `storage.rules`, `firebase.json`, testées par `tests/rules.test.mjs`). GéoFR ne les modifie pas et n'en a pas besoin.

Règles du dépôt :

- Firestore `public_catalogs/{id}` : lecture publique, écriture refusée (seul le serveur du gestionnaire écrit, avec l'Admin SDK) ;
- Storage `campaigns/…` : lecture publique des fichiers.

Comportement déployé, relevé le 2026-11-08 par des **lectures anonymes uniquement** (aucune écriture tentée) :

| Requête anonyme | Réponse | Attendu |
| --- | --- | --- |
| `public_catalogs/motissimo` | 200 | Lecture publique |
| `public_catalogs` (liste) | 200 | Lecture publique, seuls les catalogues publiés |
| `public_catalogs/geofr` | 404 | Pas encore publié |
| `campaigns`, `apps`, `applications`, `admins` | 403 | Données d'administration fermées |
| Liste Storage `campaigns/` | 403 | Pas d'inventaire des fichiers |
| Fichier vidéo publié (`?alt=media`) | 200 | Lecture publique du fichier |

**À faire par Christian avant toute modification de règles** : comparer le texte déployé (console Firebase, Firestore puis Storage, onglet Règles, historique) avec les fichiers du dépôt Motissimo. Ne jamais remplacer les règles de production sans cette comparaison et sans relancer `tests/rules.test.mjs`. L'intégration GéoFR ne demande **aucun** changement de règles.

## Publier les campagnes pour GéoFR

Dans l'interface d'administration de JavaChrist-Promotions, par Christian. Aucun changement de code du gestionnaire.

1. **Applications** : ajouter l'application `geofr` (nom GéoFR) et cocher « Ce jeu peut afficher des promotions ».
2. **Campagnes** : ouvrir SousPli, cocher GéoFR dans les jeux de diffusion, enregistrer **sans choisir de nouveau fichier**. Faire de même pour RideCloud.
3. Vérifier que `public_catalogs/geofr` répond 200 (commande plus bas).

Les campagnes Motissimo ne changent pas : leur catalogue est republié à l'identique, seuls `catalogVersion` et `generatedAt` changent.

**Poids des fichiers** : le fichier RideCloud gardé dans le dépôt Promotions pèse 11,5 Mo, mais le fichier publié dans Storage pèse 2,3 Mo (relevé le 2026-11-08). C'est le fichier publié qui compte.

## Ajouter un pays (GéoDE, GéoES…)

1. Choisir le `sourceAppId` du jeu : `geode`, `geoes`…
2. Dans JavaChrist-Promotions : ajouter l'application, cocher « Ce jeu peut afficher des promotions », puis cocher le jeu dans chaque campagne voulue.
3. Les campagnes doivent exister dans la langue du pays (`locale`) : une campagne `fr` n'est jamais montrée dans GéoDE.
4. Dans `content/<pays>/country.ts` :

   ```ts
   promotions: { catalogProjectId: "motissimo-456ba", sourceAppId: "geode", locale: "de" },
   ```

   ou `promotions: null` pour ne rien montrer.
5. Traduire le bloc `promo` de `src/i18n/locales/<langue>.json` si la langue est nouvelle.
6. Documents juridiques : la politique de confidentialité du pays doit mentionner ces vidéos (voir [juridique.md](juridique.md)).
7. `npm run check`, puis les tests manuels ci-dessous.

Aucun code dans `src/` n'est propre à un pays.

## Tests

Automatiques, avec `npm run check` (`scripts/check-promotions.mjs`) : conversion REST, catalogue vide ou absent, chaque cas de campagne refusée, recontrôle du cache, tirage sans répétition et pondéré, compteur et plafond, droits par édition, droits en cours de chargement, pays sans promotions, âge.

Manuels, dans le navigateur (le catalogue doit être publié) :

1. Version gratuite : terminer 3 niveaux. La question d'âge apparaît après les récompenses, puis la vidéo.
2. Vérifier la lecture muette, le son, le bouton vers Google Play (nouvel onglet), le X à la fin.
3. Terminer 3 autres niveaux : l'autre campagne passe.
4. Mode Famille : la vidéo n'apparaît que sur le classement final.
5. Quitter une partie en cours, recharger la page : le compteur n'avance pas.
6. Couper le réseau (outils du navigateur, hors ligne) avec un cache de plus d'1 h : aucune vidéo, aucune erreur.
7. URL de vidéo invalide (catalogue de test) : le message et le X apparaissent.
8. Compte `solo_no_ads` ou `family_no_ads` : aucune requête vers `firestore.googleapis.com` dans l'onglet Réseau, aucune question.
9. Confidentialité, Effacer : la question d'âge revient après 3 parties.

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| Jamais de vidéo | Catalogue non publié (404), édition sans publicités, réponse « moins de 18 ans », ou moins de 3 parties depuis la dernière |
| Catalogue en 200 mais rien | Campagne refusée par un contrôle : `locale`, `audience`, durée > 15 s, destination hors Google Play, dates |
| Question d'âge à chaque fois | « Plus tard » choisi, ou stockage du navigateur bloqué (navigation privée stricte) |
| Bouton « Lancer la vidéo » | Lecture automatique refusée par le navigateur (économie d'énergie, réglage) : normal |
| X immédiat avec un message | Vidéo illisible : adresse, format, ou fichier supprimé dans Storage |
| Vidéo lente à démarrer | Fichier trop lourd ou sans « fast start » |

Lire le catalogue publié :

```bash
curl -s "https://firestore.googleapis.com/v1/projects/motissimo-456ba/databases/(default)/documents/public_catalogs/geofr"
```

Effacer l'état local dans la console du navigateur : `localStorage.removeItem("geo-europe.fr.promotions")`.

## Avant la mise en production

- Christian publie `geofr` dans le gestionnaire (voir plus haut).
- **Documents juridiques** : la politique de confidentialité actuelle dit que le jeu n'a ni publicité ni donnée d'âge, et l'écran Confidentialité le répète (`privacy` dans `fr.json`). Les deux doivent être mis à jour **dans JavaChrist-Legal-Kit** par Christian (module publicité, réponse d'âge stockée sur l'appareil, lecture du catalogue chez Google Firebase), puis recopiés avec `scripts/sync-legal.mjs`. Ne jamais les modifier à la main.
- Régime publicitaire de la Découverte (`ads: null` dans `editions.ts`) : les vidéos s'y affichent aujourd'hui, à confirmer.
