# Courriels

GéoFR envoie trois courriels, tous depuis le serveur, avec les modèles de JavaChrist-Mail-Kit :

| Modèle du kit | Quand | Route ou déclencheur |
| --- | --- | --- |
| `confirmation` | Inscription par e-mail, puis « Renvoyer le lien » | `POST /api/account/verification`, compte connecté |
| `reset-password` | « Mot de passe oublié » | `POST /api/account/password-reset` |
| `purchase-confirmation` | Paiement confirmé | Notification Mollie, synchronisation ou rattrapage quotidien |

Firebase n'envoie plus lui-même ces courriels. Firebase Admin crée le lien d'action (`generateEmailVerificationLink`, `generatePasswordResetLink`). Le serveur n'en garde que le mode et le code à usage unique, et le courriel pointe vers la page de l'application `/connexion/lien?mode=…&oobCode=…`, jamais vers la page générique de Firebase (`__/auth/action`).

La page `/connexion/lien` (`src/features/account/AuthLink.tsx`) :

- confirmation d'adresse : un bouton « Confirmer mon adresse » applique le code (un clic est demandé, pour qu'un logiciel qui ouvre les liens d'un courriel ne le consomme pas), puis renvoie vers la boutique ;
- nouveau mot de passe : le lien est vérifié sans être consommé, puis le joueur choisit son mot de passe (8 caractères au moins) ;
- lien expiré, déjà utilisé ou incomplet : message `actionLinkInvalid` et retour à la connexion, d'où un nouveau lien peut être demandé.

Le code est retiré de la barre d'adresse et de l'historique dès sa lecture, la page n'envoie pas d'adresse de provenance (`referrer: no-referrer`) et n'est pas indexée. Les appels Firebase restent dans `src/services/account.ts`.

## Modèles

Les modèles viennent seulement du kit. Ils sont copiés dans `content/<pays>/mail/templates.json` par :

```bash
node scripts/sync-mail.mjs fr geofr
```

Le script lance le générateur du kit (`apps/<appId>.json`), vérifie que chaque modèle contient les variables utilisées par GéoFR, et note le commit du kit. **Ne jamais modifier `templates.json` à la main** : changer le kit, puis relancer le script.

Les variables du kit (`{{ .Nom }}`) sont remplies par `src/engine/mail.ts`. Chaque valeur est échappée. Une variable sans valeur est une erreur : aucun courriel ne part avec un `{{` visible. Une version texte est produite à partir du HTML.

## Confirmation d'achat

C'est la confirmation sur support durable. Elle contient l'édition, le prix payé TTC, la date, le numéro de commande, le rappel de l'accès immédiat et de la perte du droit de rétractation, et le lien vers les CGV. Les CGV acceptées sont jointes en texte quand leur version est encore celle de la commande.

Elle part une seule fois par commande payée (`src/services/mail/purchase-mail.ts`) :

- l'envoi est d'abord réservé dans la commande (`confirmation.claimedAt`), puis noté `confirmation.sentAt` ;
- deux notifications simultanées n'envoient donc pas deux courriels ;
- un envoi échoué libère la réservation et s'inscrit dans l'historique (`confirmationFailed`). Le rattrapage quotidien réessaie ;
- un échec d'envoi ne bloque jamais l'ouverture des droits.

## Limites d'envoi

Pour la vérification et le mot de passe oublié : un courriel par minute et cinq par heure, par adresse. Au-delà, la route répond 429 (`tooManyAttempts`). Le compteur est dans `mailThrottle/{empreinte}`, sans adresse en clair, et n'est ni lisible ni modifiable depuis le navigateur.

Seuls les envois réussis comptent. Si le serveur échoue (lien Firebase refusé, SMTP en panne ou mal configuré), la tentative est rendue : le compteur revient à son état d'avant, sauf si une autre tentative l'a modifié entre-temps. Une seule exception, voulue : pour le mot de passe oublié, un échec d'envoi vers un compte existant n'est pas rendu, sinon la limite se comporterait autrement que pour une adresse inconnue et trahirait le compte.

« Mot de passe oublié » répond de la même façon qu'un compte existe ou non.

## Configuration

Envoi par SMTP (IONOS), avec nodemailer. Les réglages sont des variables d'environnement serveur, jamais écrites dans le dépôt :

| Variable | Rôle |
| --- | --- |
| `SMTP_HOST` | Serveur d'envoi, par exemple `smtp.ionos.fr` |
| `SMTP_PORT` | `465` par défaut (TLS direct). Un autre port impose STARTTLS |
| `SMTP_USER` | Identifiant de la boîte d'envoi |
| `SMTP_PASSWORD` | Mot de passe de la boîte d'envoi. Secret |
| `MAIL_FROM` | Expéditeur, par exemple `GéoFR <adresse>` |
| `MAIL_REPLY_TO` | Facultatif. Par défaut, `legal.supportEmail` du pays |

Sans ces variables, rien n'est envoyé et les routes répondent « indisponible » (503). Il n'y a pas de repli silencieux sur les courriels de Firebase. Elles doivent donc être réglées dans Vercel **avant** le déploiement, sinon l'inscription par e-mail ne peut plus envoyer son lien.

L'export statique (Android) n'a ni connexion ni ces routes.

## Erreurs et journaux

Les routes de compte et de paiement distinguent deux cas, que l'interface ne confond jamais :

| Cas | Réponse | Message affiché |
| --- | --- | --- |
| Jeton absent, invalide, expiré ou révoqué | 401 `unauthenticated` | Session expirée |
| Firebase Admin non configuré ou injoignable, SMTP non configuré | 503 `unavailable` | Lien non envoyé (vérification), Comptes indisponibles (autres) |

L'écran de confirmation d'adresse ne dit « Un lien de confirmation a été envoyé » qu'après la réponse positive du serveur. Sinon il invite à envoyer le lien.

Pour « Mot de passe oublié », la configuration est contrôlée **avant** la recherche du compte : un 503 vaut pour toutes les adresses. Un échec d'envoi pour un compte existant est journalisé, mais la réponse reste la même que pour une adresse inconnue.

Les journaux du serveur passent par `logServerError` (`src/services/server-log.ts`) : nom, code et message de l'erreur, expurgés par `src/engine/log-safety.ts`. L'objet d'erreur n'est jamais journalisé, car il peut transporter des en-têtes ou une configuration. Jetons, clés privées, clés Mollie, liens d'action et valeurs des variables secrètes sont masqués.

## Tests

`npm run test:payments` lance un faux serveur SMTP local. Il vérifie :

- une seule confirmation d'achat par commande, même avec des notifications rejouées ;
- aucune confirmation pour un paiement refusé, annulé, échoué ou expiré ;
- la confirmation envoyée par le rattrapage ;
- le lien de vérification, la limite d'envoi, rien pour une adresse déjà vérifiée ;
- un destinataire refusé par le SMTP : 500, aucun courriel, et la tentative suivante n'est pas bloquée par un 429 ;
- le mot de passe oublié : même réponse pour une adresse inconnue, sans courriel ;
- un jeton invalide : 401 ; Firebase Admin non configuré : 503, même réponse pour une adresse connue ou inconnue ;
- aucun jeton, aucune clé ni aucun lien d'action dans le journal du serveur ;
- aucune variable laissée vide.

## Nouveau pays

Créer `apps/<appId>.json` dans le Mail-Kit, lancer `node scripts/sync-mail.mjs <pays> <appId>`, renseigner `timeZone` dans `content/<pays>/country.ts`.
