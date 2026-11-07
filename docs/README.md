# Documentation Géo Europe

GéoFR est le premier jeu de la collection Géo Europe. Le même code sert à tous les pays : seul le contenu de `content/<pays>/` change.

## Documents de référence

| Document | Contenu |
| --- | --- |
| [architecture.md](architecture.md) | Organisation du dépôt, séparation moteur et contenu, build, déploiement |
| [mode-famille.md](mode-famille.md) | Règles, déroulé, scores, stockage et éditions prévues du Mode Famille |
| [nouveau-pays.md](nouveau-pays.md) | Les 18 étapes pour ajouter un pays à la collection |
| [checklist-pays.md](checklist-pays.md) | Liste à cocher pour un pays, ce qui existe et ce qui est prévu |

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

`npm run check` enchaîne le lint, les types, l'absence d'emoji, le contenu de chaque pays, le moteur et le Mode Famille.

## Légende

Dans ces documents, **en place** veut dire que le code existe et est vérifié. **Prévu** veut dire que c'est décidé mais pas encore construit. Rien de prévu ne doit être présenté comme disponible.
