# Checklist d'un pays

À copier pour chaque nouveau pays. Le détail de chaque ligne est dans [nouveau-pays.md](nouveau-pays.md).

## Actuel : ce que le dépôt sait faire aujourd'hui

### Contenu

- [ ] `content/<pays>/country.ts` rempli, `code` identique au nom du dossier
- [ ] Documents juridiques générés par le kit et copiés dans `content/<pays>/legal/` avec `scripts/sync-legal.mjs`, `legal.kitAppId` et `legal.supportEmail` renseignés (voir [juridique.md](juridique.md))
- [ ] `content/<pays>/map.config.json` et `map.json` généré par `node scripts/build-map.mjs <pays>`
- [ ] `content/<pays>/game-maps.config.json` et `maps/*.json` générés par `node scripts/build-game-maps.mjs <pays>`
- [ ] `content/<pays>/regions/*.json`, autant que `regionCount`
- [ ] `content/<pays>/territories/*.json`, en `draft` tant qu'ils ne sont pas relus
- [ ] Un fichier `docs/sources-<parcours>.md` par parcours
- [ ] Photos dans `public/media/<pays>/`, toutes créditées dans `content/<pays>/media/credits.json`, aucune image inventée
- [ ] `content/<pays>/locales/<langue>.json`, sans bloc de tête partagé avec l'interface
- [ ] `content/<pays>/family.ts` et le bloc `familyScopes`
- [ ] `content/<pays>/index.ts`
- [ ] `src/i18n/locales/<langue>.json` si la langue est nouvelle

### Vérification

- [ ] `npm run check` passe
- [ ] `GEO_COUNTRY=<pays> npm run build` passe
- [ ] `GEO_COUNTRY=<pays> npm run build:export` passe
- [ ] Parcours Solo jouable de bout en bout dans le navigateur
- [ ] Mode Famille : une partie de 2 joueurs jouée jusqu'au classement final
- [ ] Affichage mobile vérifié
- [ ] Aucun emoji, aucun texte en dur, aucune alerte du navigateur

## Futur : prévu, pas encore construit

Chaque ligne demande la validation de Christian.

- [ ] Icônes propres au pays dans `public/`
- [ ] Projet Vercel du pays avec `GEO_COUNTRY=<pays>`
- [ ] Projet Firebase du pays
- [ ] Application Android Capacitor avec `androidPackage`
- [ ] Vente des éditions de `content/<pays>/editions.ts` (voir [editions.md](editions.md)), accès vérifié par le serveur
- [ ] Choix des deux régions de la Découverte gratuite
- [ ] Paiements et comptes
- [ ] Documents juridiques relus par Christian, version `reviewed` générée par le kit et copiée
- [ ] Retrait de `/api/health` avant la première mise en production
