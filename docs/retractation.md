# Fonction de rétractation en ligne

Depuis le 19 juin 2026, un contrat conclu en ligne doit pouvoir être rétracté en ligne, par une fonction facile à trouver. La page publique `/retractation` remplit ce rôle. Son adresse est celle du champ `withdrawalAction` du Legal Kit : `https://geofr.appsgeo.com/retractation`. Ce champ ne se remplit qu'après la validation de Christian.

**La fonction ne rembourse rien et ne retire aucun droit.** Elle reçoit la déclaration, l'horodate, l'enregistre et en accuse réception. Christian examine ensuite chaque demande, puis rembourse lui-même chez Mollie ou dans la Play Console s'il y a lieu.

## Parcours

1. **Accès.** Le consommateur ouvre `/retractation` depuis le Profil, depuis les CGV (bouton sous `conditions-de-vente`) ou depuis la Boutique. Aucune connexion n'est demandée.
2. **Formulaire.** Il saisit son nom, son adresse email et le canal d'achat (site web avec Mollie, ou Google Play). Il donne ensuite la référence de la commande et un message facultatif. Connecté, il voit ses propres commandes payées dans une liste. Son nom et son adresse sont préremplis, et tout reste modifiable.
3. **Déclaration.** Le texte de la déclaration est affiché, suivi du bouton explicite « Confirmer la rétractation ».
4. **Réception.** `POST /api/withdrawal` valide la saisie, applique les limites d'envoi, puis enregistre la demande avec la date de réception du serveur. La page affiche cette date et la référence de la demande.
5. **Accusé de réception.** Un email au modèle `withdrawal-receipt` du Mail-Kit part par le SMTP IONOS. Il reprend toutes les informations et l'horodatage. Une copie interne part à `MAIL_REPLY_TO`, ou à défaut au `supportEmail` du pays.
6. **Examen.** Un administrateur ouvre `/admin/retractations` (lien « Gérer les rétractations » dans le Profil). Il marque chaque demande comme acceptée ou refusée, avec une note facultative. Une décision est définitive et ne modifie ni la commande ni les droits.

## Rattachement à une commande

Le serveur ne rattache une demande à une commande que dans un cas : la commande est une commande Mollie de cette application, trouvée par son numéro (`orders/{id}`) ou par l'identifiant Mollie `tr_…`, **et** l'adresse du compte qui l'a passée est celle saisie. Le rattachement est noté dans l'historique de la commande (`withdrawalRequested`).

La réponse au navigateur est toujours la même, qu'il y ait rattachement ou non. Un tiers ne peut donc pas savoir si une commande existe, ni à qui elle appartient. Seul l'administrateur voit le résultat.

## Conditions légales (`assessWithdrawal`)

`src/engine/withdrawal.ts` donne à l'administrateur une indication, jamais une décision :

| Indication | Cas |
| --- | --- |
| `manualReview` | Commande non rattachée, et toujours pour Google Play |
| `alreadyRefunded` | Commande déjà remboursée ou contestée |
| `notPaid` | Commande non payée |
| `outsidePeriod` | Demande reçue plus de 14 jours après le paiement |
| `waiverRecorded` | Accès immédiat demandé, renonciation acceptée et confirmation sur support durable envoyée. Le droit de rétractation ne s'applique en principe plus (contenu numérique fourni immédiatement) |
| `withinPeriod` | Dans le délai, sans renonciation complète enregistrée : la rétractation est en principe due |

## Mollie et Google Play

- **Mollie.** La demande est rattachée automatiquement quand c'est possible. Le remboursement se fait à la main dans le tableau de bord Mollie. La notification de remboursement met ensuite à jour la commande et retire les droits, par le chemin habituel ([paiements.md](paiements.md#remboursement-et-rétrofacturation)).
- **Google Play.** Le numéro `GPA.…` est enregistré tel quel et la demande reste en `manualReview`. Le remboursement se fait dans la Play Console, ou Google le traite lui-même. L'export Android n'a pas de serveur : la page y affiche l'adresse du support au lieu du formulaire.

## Données

| Chemin | Contenu | Écrit par |
| --- | --- | --- |
| `withdrawals/{app}/requests/{id}` | Nom, adresse, canal, référence, message, `receivedAt`, commande rattachée, indication, statut, accusé de réception, décision, historique | Serveur uniquement |

`firestore.rules` ferme entièrement cette collection au navigateur, en lecture comme en écriture.

## Limites et rattrapage

- Les limites d'envoi par adresse sont celles des autres courriels. S'y ajoutent 20 demandes par fenêtre et par adresse IP.
- Si l'accusé de réception ne part pas (SMTP en panne), la demande reste enregistrée et la page le signale. Le rattrapage quotidien `GET /api/payments/reconcile` renvoie alors les accusés non partis (`acknowledged == false`). L'envoi est réservé avant de partir, si bien qu'un accusé n'est jamais envoyé deux fois en même temps.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/engine/withdrawal.ts` | Saisie, références, indication légale, décisions |
| `src/services/withdrawal.ts` | Enregistrement, rattachement, accusé, rattrapage, liste, décision |
| `src/app/api/withdrawal/route.server.ts` | Route publique |
| `src/app/api/admin/withdrawals/route.server.ts` | Liste et décision, réservées aux administrateurs |
| `src/features/withdrawal/WithdrawalForm.tsx`, `src/app/retractation/` | Page publique |
| `src/features/admin/WithdrawalAdmin.tsx`, `src/app/admin/retractations/` | Administration |
| `scripts/check-withdrawal.mjs` | Tests unitaires, lancés par `npm run check` |
| `scripts/test-payments-emulator.mjs` | Tests d'intégration (5 scénarios de rétractation) |

## Autre pays

Rien n'est propre à la France dans `src/` : l'application vient de `APP_ID`, l'adresse du support de `content/<pays>/config`, les textes de la locale, et le modèle d'email du Mail-Kit copié par `scripts/sync-mail.mjs`. Pour un nouveau pays, il faut :

- générer `withdrawal-receipt` dans le Mail-Kit pour sa marque ;
- renseigner `withdrawalAction` dans sa configuration du Legal Kit ;
- faire valider le délai et les textes par Christian, si le droit applicable diffère.
