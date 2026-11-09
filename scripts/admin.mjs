// Administrateurs des accès offerts : seul moyen de créer ou de retirer un administrateur. Aucune route publique ne le permet.
// Lancé en local par Christian, avec le compte de service Firebase Admin (voir docs/acces-offerts.md). Jamais de clé dans le dépôt.
//
// Usage :
//   node scripts/admin.mjs <pays> add <adresse> --project <id>     donne l'administration de l'application du pays
//   node scripts/admin.mjs <pays> remove <adresse> --project <id>  la retire
//   node scripts/admin.mjs <pays> list --project <id>              liste les administrateurs de l'application
//
// Projet : --project, sinon FIREBASE_ADMIN_PROJECT_ID, sinon NEXT_PUBLIC_FIREBASE_PROJECT_ID.
// Identifiants : GOOGLE_APPLICATION_CREDENTIALS (chemin d'une clé de compte de service rangée hors du dépôt),
// ou FIREBASE_ADMIN_CLIENT_EMAIL et FIREBASE_ADMIN_PRIVATE_KEY comme le serveur.
// Avec FIRESTORE_EMULATOR_HOST et FIREBASE_AUTH_EMULATOR_HOST, les émulateurs.
// Le script n'affiche jamais de clé ni de jeton.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const projectFlag = args.indexOf("--project");
const projectArg = projectFlag >= 0 ? args[projectFlag + 1] : undefined;
if (projectFlag >= 0) args.splice(projectFlag, 2);
const [country, command, rawEmail] = args;
const usage = () => {
  console.error(
    "Usage : node scripts/admin.mjs <pays> add|remove <adresse> [--project <id>]  |  node scripts/admin.mjs <pays> list [--project <id>]",
  );
  process.exit(1);
};
if (
  !country ||
  !/^[a-z]{2}$/.test(country) ||
  !["add", "remove", "list"].includes(command ?? "")
)
  usage();
if (command !== "list" && !rawEmail) usage();

const countryFile = resolve(join("content", country, "country.ts"));
if (!existsSync(countryFile)) {
  console.error(`Pays inconnu : content/${country}/country.ts introuvable.`);
  process.exit(1);
}
const countryModule = await import(pathToFileURL(countryFile).href);
const appId = (countryModule.country ?? countryModule.default)?.legal?.kitAppId;
if (!appId) {
  console.error("legal.kitAppId introuvable dans country.ts.");
  process.exit(1);
}

const projectId =
  projectArg ||
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error(
    "Projet Firebase inconnu : ajouter --project <id>, ou définir FIREBASE_ADMIN_PROJECT_ID.",
  );
  process.exit(1);
}
const credentialsHelp =
  "Identifiants Firebase Admin manquants ou refusés. Définir GOOGLE_APPLICATION_CREDENTIALS avec le chemin d'une clé de compte de service du projet, rangée hors du dépôt (voir docs/acces-offerts.md).";
const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
  /\\n/g,
  "\n",
);
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const credential = emulated
  ? undefined
  : clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();
const app = initializeApp({ projectId, ...(credential && { credential }) });
const auth = getAuth(app);
const db = getFirestore(app);
const admins = db.collection("admins");

console.log(
  `Projet ${projectId}${emulated ? " (émulateurs)" : ""}, application ${appId}.`,
);

/** Toute erreur autre que « compte introuvable » vient des identifiants ou du réseau : jamais de détail technique ni de clé. */
const failCredentials = () => {
  console.error(credentialsHelp);
  process.exit(1);
};

if (command === "list") {
  const snapshot = await admins
    .where("apps", "array-contains", appId)
    .get()
    .catch(failCredentials);
  if (snapshot.empty) console.log("Aucun administrateur.");
  for (const doc of snapshot.docs)
    console.log(`- ${doc.data().email ?? "(adresse inconnue)"}  uid ${doc.id}`);
  process.exit(0);
}

const email = rawEmail.trim().normalize("NFC").toLowerCase();
let user;
try {
  user = await auth.getUserByEmail(email);
} catch (error) {
  if (error?.code !== "auth/user-not-found") failCredentials();
  console.error(
    "Aucun compte avec cette adresse. L'administrateur doit d'abord créer son compte dans le jeu et confirmer son adresse.",
  );
  process.exit(1);
}
const google = user.providerData.some(
  (provider) => provider.providerId === "google.com",
);

if (command === "add") {
  if (!user.emailVerified && !google) {
    console.error(
      "Adresse non confirmée : l'administrateur doit d'abord confirmer son adresse dans le jeu.",
    );
    process.exit(1);
  }
  await admins.doc(user.uid).set(
    {
      email,
      apps: FieldValue.arrayUnion(appId),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  console.log(`${email} administre maintenant les accès offerts de ${appId}.`);
} else {
  const ref = admins.doc(user.uid);
  const snapshot = await ref.get();
  const apps = (snapshot.data()?.apps ?? []).filter((id) => id !== appId);
  if (!snapshot.exists) console.log(`${email} n'était pas administrateur.`);
  else if (apps.length === 0) await ref.delete();
  else await ref.update({ apps, updatedAt: new Date().toISOString() });
  console.log(`${email} n'administre plus ${appId}.`);
}
process.exit(0);
