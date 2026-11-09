# Checklist d'un pays

À copier pour chaque nouveau pays. Le détail de chaque ligne est dans [nouveau-pays.md](nouveau-pays.md).

## Actuel : ce que le dépôt sait faire aujourd'hui

### Contenu

- [ ] `content/<pays>/country.ts` rempli, `code` identique au nom du dossier
- [ ] Documents juridiques générés par le kit et copiés dans `content/<pays>/legal/` avec `scripts/sync-legal.mjs`, `legal.kitAppId` et `legal.supportEmail` renseignés (voir [juridique.md](juridique.md))
- [ ] Modèles de courriel générés par le Mail-Kit et copiés dans `content/<pays>/mail/` avec `scripts/sync-mail.mjs`, `timeZone` renseigné (voir [courriels.md](courriels.md))
- [ ] `content/<pays>/map.config.json` et `map.json` généré par `node scripts/build-map.mjs <pays>`
- [ ] `content/<pays>/game-maps.config.json` et `maps/*.json` générés par `node scripts/build-game-maps.mjs <pays>`
- [ ] `content/<pays>/regions/*.json`, autant que `regionCount`
- [ ] `content/<pays>/territories/*.json`, en `draft` tant qu'ils ne sont pas relus
- [ ] Un fichier `docs/sources-<parcours>.md` par parcours
- [ ] Photos dans `public/media/<pays>/`, toutes créditées dans `content/<pays>/media/credits.json`, aucune image inventée
- [ ] `content/<pays>/locales/<langue>.json`, sans bloc de tête partagé avec l'interface
- [ ] `content/<pays>/family.ts` et le bloc `familyScopes`
- [ ] `content/<pays>/index.ts`
- [ ] `promotions` renseigné dans `country.ts` (ou `null`), `sourceAppId` créé dans JavaChrist-Promotions et coché dans les campagnes de la langue du pays (voir [promotions.md](promotions.md))
- [ ] `src/i18n/locales/<langue>.json` si la langue est nouvelle

### Vérification

- [ ] `npm run check` passe
- [ ] `GEO_COUNTRY=<pays> npm run build` passe
- [ ] `GEO_COUNTRY=<pays> npm run build:export` passe
- [ ] Parcours Solo jouable de bout en bout dans le navigateur
- [ ] Mode Famille : une partie de 2 joueurs jouée jusqu'au classement final
- [ ] Affichage mobile vérifié
- [ ] Aucun emoji, aucun texte en dur, aucune alerte du navigateur
- [ ] Promotions : vidéo après 3 parties, jamais en partie ni entre deux tours Famille, aucune requête avec une édition sans publicités
- [ ] AdMob : `content/<pays>/android.json` et `ads` dans `country.ts` avec les ID de démonstration, `GEO_COUNTRY=<pays> npm run check:ads` passe, cas de test de [admob.md](admob.md#tests-sur-lémulateur) vérifiés sur l'émulateur

## Futur : prévu, pas encore construit

Chaque ligne demande la validation de Christian.

- [ ] Icônes propres au pays dans `public/`
- [ ] Projet Vercel du pays avec `GEO_COUNTRY=<pays>`
- [ ] Projet Firebase du pays
- [ ] Publication Google Play : connexion, Play Billing, identifiants AdMob réels, déclaration de sécurité des données (voir [admob.md](admob.md#avant-une-publication-google-play))
- [ ] Vente réelle des éditions de `content/<pays>/editions.ts` : boutique et droits en place en mode test, points restants dans [paiements.md](paiements.md#avant-la-vente-réelle)
- [ ] Administrateur des accès offerts nommé avec `scripts/admin.mjs <pays> add <adresse> --project <id>` (voir [acces-offerts.md](acces-offerts.md#administration-sécurisée))
- [ ] Choix des deux régions de la Découverte gratuite
- [ ] Paiements et comptes
- [ ] Documents juridiques relus par Christian, version `reviewed` générée par le kit et copiée
- [ ] Retrait de `/api/health` avant la première mise en production
