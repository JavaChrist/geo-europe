# Défis nationaux

Les trois modes de la section « Autres défis » de la page Défis : Défi du jour, Défi de France et Défis thématiques. Ils sont communs à tous les pays de la collection. Un pays n'apporte que ses questions, ses thèmes (ceux du Mode Famille, `content/<pays>/family.ts`) et les textes de ses badges.

Règles validées par Christian le 10 novembre 2026. Ce document est la référence : le code et les contrôles (`scripts/check-engine.mjs`) le suivent.

## Ce qui est commun aux trois modes

- **Aucune question écrite pour eux.** Chaque tirage puise dans les questions publiées des territoires, avec leurs trois formats (choix, image, carte).
- **Aucun joker, aucun chronomètre, un seul essai par question.** L'indice n'apparaît donc jamais.
- **Parties reprenables.** Une partie commencée est gardée sur l'appareil à chaque réponse (`src/services/paused-runs.ts`), comme celles des niveaux et des défis régionaux. Elle se reprend après une sortie, un rechargement ou une fermeture de l'application par Android.
- **Sortie protégée.** La modale « Quitter le quiz ? » s'ouvre sur la navigation du bas, l'en-tête, tout lien et le bouton retour du navigateur ou d'Android (`useLeaveGuard`). Le bouton « Défi suivant » reste visible au-dessus de la navigation.
- **Écran de jeu :** `useHoldUpdate` (pas de modale de mise à jour pendant la partie) et `usePromotion` (pas de vidéo pendant la partie).
- **Récompenses jamais gagnées deux fois.** La partie gardée est effacée avant l'enregistrement du résultat. Les badges se déduisent des résultats enregistrés, et l'XP du jour n'est écrit qu'une fois par jour.
- **Droits :** tout verrou lit `useEntitlements()`. Rien ne s'ouvre sur la foi du navigateur.

## Défi du jour

| Règle | Valeur |
| --- | --- |
| Questions | 5 |
| Difficulté | 1 à 3 |
| Essais, jokers, chronomètre | 1 essai, aucun joker, aucun chronomètre |
| Échec | Impossible : on compte les bonnes réponses |
| Tirage | Fixe pour la journée, tiré dans les régions accessibles au joueur |
| Récompense | 1 XP par bonne réponse, plus 5 XP quand les 5 questions sont terminées, une seule fois par jour |
| Série | Jours consécutifs terminés, série en cours et meilleure série |

- **Le jour** est la date locale de l'appareil au départ de la partie, au format `AAAA-MM-JJ`. Il est écrit dans la partie : une partie commencée avant minuit reste terminable après minuit, sans arrêt forcé, et elle compte pour son jour de départ.
- **Le tirage** est déterminé par le jour et par l'ensemble des régions accessibles : tous les joueurs qui ont les mêmes droits ont les mêmes 5 questions ce jour-là. Il ne dépend pas de l'historique du joueur.
  - Découverte : les régions gratuites de `editions.ts` (GéoFR : Île-de-France et Occitanie).
  - Solo, Famille, Accès offert : toutes les régions.
- **Une journée compte** lorsque les 5 questions sont terminées. Une partie quittée en route reste reprenable et ne rapporte rien tant qu'elle n'est pas finie.
- **Une seule récompense par jour.** Une fois la journée terminée, l'écran montre le résultat du jour et « Revenez demain ». Une reprise, un second onglet ou une partie gardée du même jour ne rapportent plus rien : le résultat d'un jour déjà enregistré n'est jamais remplacé.
- **Série en cours :** nombre de jours consécutifs terminés jusqu'à aujourd'hui, ou jusqu'à hier si aujourd'hui n'est pas encore joué. **Meilleure série :** la plus longue suite de jours consécutifs jamais terminée.
- **XP :** l'XP du jour s'ajoute au total du Profil. Il est rangé à part des niveaux, dans `daily` (voir [Stockage](#stockage)).

## Défi de France

| Règle | Valeur |
| --- | --- |
| Questions | 10, de 10 régions différentes |
| Difficulté | 2 à 3 |
| Essais, jokers, chronomètre | 1 essai, aucun joker, aucun chronomètre |
| Réussite | 8 bonnes réponses sur 10 |
| Récompense | Badge national à la première réussite, aucun XP |
| Droits | Solo, Famille et Accès offert. Verrouillé en Découverte |

- Le tirage suit celui du Défi Maître (questions récentes évitées, thèmes représentés) avec une question au plus par région administrative.
- La réussite est permanente : une partie moins bonne ne retire jamais le badge.
- En Découverte, une carte de verrou mène à la boutique, sans démarrer de partie.

## Défis thématiques

Un défi par thème du Mode Famille. GéoFR : Géographie, Villes et patrimoine, Histoire, Gastronomie, Traditions.

| Règle | Valeur |
| --- | --- |
| Questions | 10, des seules catégories du thème |
| Difficulté | 2 à 3 |
| Essais, jokers, chronomètre | 1 essai, aucun joker, aucun chronomètre |
| Réussite | 8 bonnes réponses sur 10, comme le Défi Maître |
| Récompense | Un badge de maîtrise par thème, aucun XP |

- **Éditions payantes et Accès offert :** le défi complet, avec les questions de toutes les régions. Sa réussite donne le badge de maîtrise du thème.
- **Découverte :** le même défi, jouable avec les seules questions des deux régions gratuites. Le résultat est gardé à part et **ne donne pas le badge**. L'écran du thème le dit avant de jouer, et rappelle que le badge se gagne sur le défi complet.
- Un joueur Découverte qui achète ensuite une édition commence le défi complet sans résultat : sa réussite en Découverte ne vaut pas badge.

## Badges et album

Six badges, sans XP : un badge national « Défi de France » et un badge par thème. Ils n'ont pas d'illustration : l'album montre leur icône.

- Un badge est gagné quand le résultat enregistré du défi complet est réussi (`passed`). Il n'est jamais stocké à part : il se déduit du résultat, comme les autres badges.
- L'album a une section **« Défis nationaux »** avec ces six badges. Ils comptent dans le total des badges de l'album et apparaissent dans « Mes badges » du Profil.
- Textes des badges : `nationalChallenges.badges.*` dans `content/<pays>/locales/`.

## Stockage

Tout reste sur l'appareil, dans `geo-europe.<pays>.progress`, espace `device`.

| Donnée | Clé | Contenu |
| --- | --- | --- |
| Défi du jour | `daily.<AAAA-MM-JJ>` | Bonnes réponses, XP gagné, date de fin |
| Défi de France | `challenges["national:france"]` | Résultat du défi, comme un Défi Maître |
| Défi thématique complet | `challenges["national:theme:<thème>"]` | Idem, donne le badge |
| Défi thématique Découverte | `challenges["national:theme:<thème>:discovery"]` | Idem, sans badge |

L'historique des questions du Défi de France et des Défis thématiques porte la clé du défi, comme pour les défis régionaux. Le Défi du jour n'a pas d'historique : son tirage ne dépend que du jour.

## Réinitialisation

- **Tout le pays :** efface aussi les jours du Défi du jour (donc leur XP et la série), les résultats des défis nationaux et leurs badges. L'aperçu les compte avant la confirmation.
- **Un territoire ou un niveau :** ne touche pas les défis nationaux.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/engine/national-challenges.ts` | Règles, banques, tirages, jour, série, XP du jour, badges |
| `src/services/local-progress.ts` | Enregistrement du jour et des résultats |
| `src/features/national/` | Écrans des trois modes |
| `src/app/defis/jour/`, `src/app/defis/france/`, `src/app/defis/themes/` | Adresses des modes |
| `scripts/check-engine.mjs` | Contrôles des règles |
