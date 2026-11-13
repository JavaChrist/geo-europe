# Envoi en test interne Google Play

`scripts/play-release.mjs` envoie un Android App Bundle (AAB) sur la piste **test interne** de Google Play, avec l'API Google Play Developer v3. Le script n'a aucune dépendance : il lit le bundle lui-même et signe le jeton OAuth avec `node:crypto`.

Garde-fous :

- **Simulation par défaut.** Le script fait seulement des contrôles locaux. Il n'appelle pas le réseau et ne modifie rien dans la Play Console.
- **Envoi seulement avec `--send`**, et seulement sur la piste `internal`. La piste n'est pas un paramètre. `--track`, `--production`, `--promote` et une clé `track` dans la configuration sont refusés.
- **Aucun accès à la production.** Le script ne crée, ne promeut et ne modifie aucune version de production, de test fermé ou de test ouvert. Il lit les autres pistes pendant un envoi, seulement pour connaître le plus haut versionCode.
- La production reste une décision de Christian, prise dans la Play Console (voir [Production](#production)).

## Configuration par application

Chaque application a un fichier `play-release.json`. Pour Géo Europe, il est dans `content/<pays>/play-release.json`, et `GEO_COUNTRY` le choisit (`fr` par défaut). Les chemins sont relatifs à la racine du dépôt Git.

```json
{
  "app": "GéoFR",
  "packageName": "fr.javachrist.geofr",
  "bundle": "android/app/build/outputs/bundle/release/app-release.aab",
  "gradleFile": "android/app/build.gradle",
  "uploadCertSha256": "F8:3B:…:7F:39",
  "lastUploadedVersionCode": 12,
  "credentials": "~/.geo-play/geofr-release.json",
  "billingServiceAccount": "geofr-play-billing@geofr-d5224.iam.gserviceaccount.com",
  "bundleJson": [{ "entry": "base/assets/public/geo-export.json", "expect": { "payments": "play", "apiBase": "https://geofr.appsgeo.com" } }],
  "releaseNotes": { "fr-FR": "content/fr/play/release-notes/fr-FR.txt" }
}
```

| Clé | Rôle |
| --- | --- |
| `app` | Nom affiché dans le rapport. |
| `packageName` | Package attendu. Il doit être identique à celui du manifeste de l'AAB. |
| `bundle` | AAB produit par `bundleRelease`. `--bundle` le remplace pour un envoi. |
| `gradleFile` | Facultatif. Son `versionCode` doit être celui de l'AAB : sinon le bundle n'est pas à jour. |
| `uploadCertSha256` | Empreinte SHA-256 du certificat de la clé d'importation. Une empreinte n'est pas un secret : elle s'affiche dans la Play Console (Intégrité de l'application) et avec `keytool -printcert -jarfile`. |
| `lastUploadedVersionCode` | Dernier versionCode connu sur Play, toutes pistes confondues. L'AAB doit le dépasser. À mettre à jour dans le commit de chaque version. |
| `credentials` | Clé JSON du compte de service **dédié aux versions**. Le fichier doit être hors du dépôt, sinon la configuration est refusée. `~` désigne le dossier personnel. La variable `PLAY_RELEASE_CREDENTIALS` la remplace. |
| `billingServiceAccount` | Facultatif. Compte de facturation de l'application. Le script refuse ces identifiants pour un envoi, comme tout compte dont l'adresse contient `billing`. |
| `bundleJson` | Facultatif. Fichiers JSON du bundle à comparer à des valeurs attendues. GéoFR vérifie le marqueur `geo-export.json` : canal `play` et serveur de production. |
| `releaseNotes` | Facultatif. Langue Play (`fr-FR`, `en-US`) vers un fichier texte de 500 caractères au plus. Sans notes, la version part sans notes. |

`npm run check` contrôle la forme de chaque `content/*/play-release.json` (`node scripts/play-release.mjs --check-config`).

### Motissimo, Cubelyo et les autres applications

Le script ne dépend pas de Géo Europe. Pour une autre application JavaChrist :

1. Copier `scripts/play-release.mjs` dans le dépôt de l'application.
2. Y écrire un `play-release.json` avec son package, son AAB, son `build.gradle`, l'empreinte de sa propre clé d'importation et son `lastUploadedVersionCode`.
3. Donner à `credentials` un fichier propre à l'application, par exemple `~/.geo-play/motissimo-release.json`.
4. Lancer `node scripts/play-release.mjs --config play-release.json`.

`bundleJson` reste vide quand l'application n'a pas de marqueur de build. Cette copie se fait dans le dépôt de l'application, avec la validation de Christian.

## Compte de service dédié aux versions

Le compte `geofr-play-billing` ne sert qu'aux achats : données financières et commandes. Il ne peut pas envoyer de version, et il ne faut pas élargir ses droits.

Pour envoyer, Christian crée un compte séparé, une seule fois :

1. Google Cloud, dans le projet de l'application : créer un compte de service, par exemple `geo-play-release`, puis une clé JSON.
2. Enregistrer la clé hors du dépôt, à l'adresse de `credentials`, par exemple `C:\Users\<vous>\.geo-play\geofr-release.json`. Elle ne va jamais dans Git, dans Vercel ni dans une conversation.
3. Play Console, Utilisateurs et autorisations : inviter l'adresse du compte, sur l'application seulement. Lui donner « Publier des versions dans les canaux de test » et rien d'autre. Ne pas lui donner l'accès à la production, aux données financières ni aux commandes.

Le script affiche l'adresse du compte. Il n'affiche jamais la clé ni le jeton, et ne les écrit dans aucun rapport.

## Utilisation

1. Construire l'AAB signé (voir [admob.md](admob.md), section build) après avoir augmenté `versionCode` dans `android/app/build.gradle`.
2. Simuler :

   ```bash
   npm run play:release
   ```

3. Lire le rapport. Chaque ligne est `OK`, `ATTENTION` ou `ERREUR`. Une seule `ERREUR` bloque l'envoi.
4. Envoyer en test interne, seulement si la simulation dit « prêt » :

   ```bash
   npm run play:release -- --send
   ```

5. Passer `lastUploadedVersionCode` au versionCode envoyé dans `play-release.json`, dans le commit de la version.

Pour un autre pays : `GEO_COUNTRY=de npm run play:release`.

### Contrôles locaux (simulation et envoi)

| Contrôle | Refus si |
| --- | --- |
| Bundle | fichier absent ou zip illisible |
| Package | le manifeste de l'AAB (`base/manifest/AndroidManifest.xml`) ne donne pas `packageName` |
| versionCode | différent de `gradleFile`, ou pas plus grand que `lastUploadedVersionCode` et que le dernier envoi réussi de ce script |
| Signature | `jarsigner -verify` échoue, entrées non signées, plusieurs signataires, ou empreinte différente de `uploadCertSha256` |
| Contenu | une valeur de `bundleJson` diffère |
| Notes de version | fichier absent, vide, ou plus de 500 caractères |
| Identifiants | fichier dans le dépôt, clé qui n'est pas celle d'un compte de service, compte de facturation. Absents : simple avertissement en simulation, refus pour un envoi. |

Le script avertit aussi quand `gradleFile` a été modifié après le bundle. `jarsigner` et `keytool` viennent du JDK (`JAVA_HOME`, sinon le `PATH`).

### Envoi (`--send`)

L'envoi ne commence que si tous les contrôles locaux passent. Ensuite :

1. Jeton OAuth du compte de versions, puis ouverture d'une édition.
2. Lecture des bundles et des pistes de l'édition. Refus si le versionCode ne dépasse pas le plus haut versionCode déjà sur Play.
3. Envoi du bundle en reprise (`uploadType=resumable`). Play doit relire le même versionCode et la même empreinte SHA-256.
4. Piste `internal` : une version `completed` avec ce versionCode et les notes.
5. Validation de l'édition, puis publication de l'édition (commit).

Si une étape échoue avant le commit, le script supprime l'édition : rien n'est publié.

Il ne faut pas envoyer pendant qu'une version de production est en cours d'examen. Une édition validée peut alors se mêler aux modifications en attente. En cas de doute, la simulation suffit.

### Rapport

Chaque exécution affiche le résultat et écrit un rapport JSON hors du dépôt, dans `~/.geo-play/reports/<package>/<date>-simulation.json` ou `<date>-send.json`. Le rapport contient :

- les contrôles ;
- le package, le versionCode et le versionName ;
- la taille, l'empreinte SHA-256, le signataire et l'empreinte du certificat ;
- l'adresse du compte de service ;
- l'identifiant de l'édition ;
- le résultat : `ready`, `blocked`, `committed` ou `failed`.

Il ne contient ni clé ni jeton. Code de sortie : `0` prêt ou envoyé, `1` bloqué ou échec, `2` option ou configuration invalide.

## Ce qui reste hors du script

| Étape | Où |
| --- | --- |
| Fiche Store, captures, icône | Play Console (API Edits possible plus tard, à valider) |
| Formulaire Sécurité des données (import du CSV, voir [admob.md](admob.md)) | Play Console, aucune API |
| Classification, public cible, accès à l'application, déclaration publicité | Play Console, aucune API |
| Tests fermés, ouverts, production | Play Console, décision de Christian |

## Production

Cette version ne touche jamais à la production. Pour publier :

1. Christian vérifie la version en test interne.
2. Il donne son accord écrit.
3. Il promeut lui-même ce versionCode dans la Play Console, sans nouveau build, puis l'envoie pour examen.

Une future option de production demandera une nouvelle validation, un droit séparé pour le compte de service et une confirmation du versionCode dans la commande.
