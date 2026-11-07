# Mode Famille

De 2 à 4 joueurs sur un même appareil, chacun son tour, sans compte et sans connexion. Route : `/famille`.

## Règles

| Règle | Valeur |
| --- | --- |
| Joueurs | 2 à 4, choisis parmi les profils de l'appareil. L'ordre de sélection donne l'ordre de passage |
| Profil | Prénom de 16 caractères au plus, couleur et initiale, réutilisable d'une partie à l'autre |
| Durée | Rapide 3 manches, Classique 5 (par défaut), Longue 10 |
| Questions par tour | Rapide 5, Classique 3, Longue 3, jouées d'affilée par le même joueur |
| Questions | Toute la France, un thème ou un parcours publié |
| Manche | Un tour par joueur. Toutes les questions de la manche ont la même difficulté |
| Ordre | Le premier joueur change à chaque manche, pour que personne ne commence toujours |
| Essais | 2 par question. Après une erreur, l'indice s'affiche |
| Jokers 50/50 | Rapide 2, Classique 3, Longue 5, les mêmes pour chaque joueur, décomptés par joueur |
| Chronomètre | Aucun |

## Points

| Réponse | Points |
| --- | --- |
| Bonne réponse sans aide | 10 |
| Bonne réponse après l'indice | 7 |
| Bonne réponse avec un 50/50 | 5 |
| Mauvaise réponse | 0 |

Chaque question est comptée à part. Avec plusieurs aides, la valeur la plus basse s'applique : indice et 50/50 donnent 5.

| Durée | Manches | Questions par joueur | Maximum par joueur |
| --- | --- | --- | --- |
| Rapide | 3 | 15 | 150 points |
| Classique | 5 | 15 | 150 points |
| Longue | 10 | 30 | 300 points |

Les points du Mode Famille restent à part. Ils ne donnent ni XP, ni carte souvenir, ni record, et ne débloquent aucun niveau.

## Déroulé

1. **Préparation** : choix des joueurs, de la durée et des questions. Le nombre de questions disponibles s'affiche. Si le choix est trop petit pour la durée choisie, un message l'explique, propose les durées encore jouables ou un choix plus large, et le lancement reste bloqué. Exemple : la Corse, la Guyane, la Martinique, Mayotte et la Champagne-Ardenne ne suffisent pas pour 4 joueurs en Longue.
2. **Passage** : « Au tour de Léa ». Les questions restent cachées jusqu'au bouton « Voir mes questions ».
3. **Tour** : le joueur enchaîne ses 3 ou 5 questions sur le même écran que le Solo (`ChallengeView`), avec les trois formats existants, choix, image et carte. « Question suivante » entre deux questions, puis « Joueur suivant » ou le classement à la dernière.
4. **Classement de manche** : total de chacun et points gagnés pendant la manche.
5. **Fin de partie** : animation, vainqueur ou vainqueurs ex æquo, classement détaillé (points, bonnes réponses, indices, 50/50), boutons « Rejouer » et « Retour à l'accueil ».

Abandonner passe par une confirmation `useModal`. Une partie abandonnée n'entre pas dans l'historique.

## Tirage des questions

- Le moteur réutilise les questions existantes des parcours publiés. Le Mode Famille n'ajoute aucune question et n'invente aucune donnée.
- Une partie ne contient jamais deux fois la même question, ni deux questions d'un même groupe.
- Les questions des 3 dernières parties terminées sont tirées en dernier.
- Chaque manche a une seule difficulté, et les difficultés montent au fil de la partie quand le contenu le permet.
- Une partie demande joueurs × manches × questions par tour questions différentes : 120 pour 4 joueurs en Longue.
- Si le choix ne contient pas assez de questions pour une manche complète de chaque difficulté prévue, la partie ne démarre pas et l'écran propose une durée plus courte ou un choix plus large.

## Égalité

Les joueurs à égalité de points partagent le même rang. Plusieurs joueurs au rang 1 sont tous vainqueurs.

## Stockage et reprise

Clé `geo-europe.<pays>.family` dans `localStorage` :

- `players` : profils de l'appareil ;
- `history` : 20 dernières parties terminées ;
- `current` : partie en cours, enregistrée après chaque réponse ;
- `recent` : questions des 3 dernières parties.

Après un rechargement, la carte « Partie en cours » propose de reprendre exactement où la partie s'était arrêtée. Une partie illisible, modifiée à la main ou commencée avant le passage à plusieurs questions par tour est oubliée plutôt que reprise. Les joueurs et l'historique sont gardés. La mise à jour de l'application attend la fin de la partie (`useHoldUpdate`).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/engine/family.ts` | Règles (`FAMILY_RULES`, dont `questionsPerTurn`), tirage, déroulé, points, classement. Sans React ni stockage |
| `src/services/family-storage.ts` | Lecture, validation et écriture locales |
| `src/services/family-access.ts` | Frontière d'accès, toujours ouverte |
| `src/features/family/FamilyMode.tsx` | Écrans de la partie et historique |
| `src/features/family/FamilySetup.tsx` | Préparation de la partie |
| `src/features/family/family-ui.tsx` | Pastilles, classement, styles communs |
| `src/features/journey/ChallengeView.tsx` | Écran de question partagé avec le Solo, libellés Famille passés par la prop `labels` |
| `content/<pays>/family.ts` | Thèmes du pays, qui regroupent des catégories de questions existantes |
| `content/<pays>/locales/<langue>.json`, bloc `familyScopes` | Noms des thèmes et de « Toute la France » |
| `src/i18n/locales/<langue>.json`, bloc `family` | Textes de l'interface du Mode Famille |
| `scripts/check-family.mjs` | Tests automatiques, lancés par `npm run check` |

## Éditions prévues

Rien de ceci n'est actif. Aucun paiement, aucun compte, aucune édition payante.

Achats uniques, sans abonnement, prix TTC. La grille complète de la collection, avec les éditions Solo et la Découverte gratuite, est dans [editions.md](editions.md). Les prix ne vivent que dans `content/<pays>/editions.ts`.

| Édition | Prix prévu | État |
| --- | ---: | --- |
| Famille complète avec publicités (`family_ads`) | 14,99 € | Prévu |
| Famille complète sans publicités (`family_no_ads`) | 19,99 € | Prévu |

Aujourd'hui, `familyAccess()` répond toujours `{ allowed: true }`. Le jour où ces éditions existeront, seule cette frontière changera, et l'accès sera vérifié par le serveur, jamais à partir d'un résultat du navigateur.

## Tests

`npm run check:family` vérifie :

- le barème et la règle de l'aide la plus basse ;
- le tirage sur le vrai contenu de chaque pays, pour 2 joueurs en 3 manches, 3 en 5 et 4 en 10 : pas de doublon, pas de groupe en double, même difficulté par manche, les trois formats présents ;
- les questions récentes tirées en dernier ;
- le refus d'un choix trop petit et les durées encore jouables ;
- des parties complètes simulées : égalité, changement de joueur, jokers épuisés, classement ;
- la reprise après un aller-retour JSON, et le refus d'une partie abîmée.

L'affichage, l'animation, le mobile et les modales se vérifient dans le navigateur.
