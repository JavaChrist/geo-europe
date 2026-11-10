# Documentation Géo Europe

GéoFR est le premier jeu de la collection Géo Europe. Le même code sert à tous les pays : seul le contenu de `content/<pays>/` change.

## Documents de référence

| Document | Contenu |
| --- | --- |
| [architecture.md](architecture.md) | Organisation du dépôt, séparation moteur et contenu, build, déploiement |
| [mode-famille.md](mode-famille.md) | Règles, déroulé, scores, stockage et éditions prévues du Mode Famille |
| [defis-nationaux.md](defis-nationaux.md) | Défi du jour, Défi de France et Défis thématiques : règles validées, droits, XP du jour, série, badges, stockage |
| [nouveau-pays.md](nouveau-pays.md) | Les 18 étapes pour ajouter un pays à la collection |
| [checklist-pays.md](checklist-pays.md) | Liste à cocher pour un pays, ce qui existe et ce qui est prévu |
| [editions.md](editions.md) | Les cinq éditions, leurs tarifs, où ils vivent et comment les changer |
| [juridique.md](juridique.md) | Documents juridiques : intégration de JavaChrist-Legal-Kit, procédure par pays, manques connus |
| [paiements.md](paiements.md) | Achat web Mollie et Google Play Billing (Android) en mode test, commandes, droits d'accès, variables, tests, configuration Play, iOS plus tard |
| [acces-offerts.md](acces-offerts.md) | Édition Famille sans publicité offerte à des adresses autorisées : administration, premier administrateur, règles Firestore, Android, tests |
| [promotions.md](promotions.md) | Vidéos JavaChrist-Promotions entre deux parties : catalogue, lecteur, fréquence, éditions sans publicités, âge, nouveau pays |
| [courriels.md](courriels.md) | Courriels de compte et confirmation d'achat : modèles de JavaChrist-Mail-Kit, envoi SMTP, limites, tests |
| [admob.md](admob.md) | Bannière Google AdMob de l'application Android : Capacitor, âge et Families, UMP, éditions sans publicités, droits réels, pack d'assets, tests sur l'émulateur, Play, propositions pour le Legal Kit |
| [retractation.md](retractation.md) | Fonction de rétractation en ligne : parcours, rattachement, conditions légales, Mollie et Google Play, administration, autre pays |

## Fichiers de relecture

Les fichiers `sources-*.md`, comme [sources-alsace-bienvenue.md](sources-alsace-bienvenue.md), listent les sources des questions. Ils ne sont ni importés ni publiés.

## Commandes

```bash
npm run dev
```

```bash
npm run check
```

```bash
npm run build
```

```bash
npm run build:export
```

`npm run check` enchaîne le lint, les types, l'absence d'emoji, le contenu de chaque pays (dont les modèles de courriel), le moteur, le Mode Famille, les documents juridiques, les droits d'accès, les promotions et la configuration AdMob (identifiants de démonstration uniquement).

## Légende

Dans ces documents, **en place** veut dire que le code existe et est vérifié. **Prévu** veut dire que c'est décidé mais pas encore construit. Rien de prévu ne doit être présenté comme disponible.
