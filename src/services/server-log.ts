import { describeError, redactSecrets } from "@/engine/log-safety";

// Serveur uniquement : les journaux de Vercel ne reçoivent jamais de clé privée ni de jeton.
if (typeof window !== "undefined") throw new Error("Le journal du serveur est réservé au serveur");

/** Valeurs des secrets de l'environnement, masquées si une erreur les recopie dans son message. */
const SECRET_VARIABLES = ["FIREBASE_ADMIN_PRIVATE_KEY", "SMTP_PASSWORD", "MOLLIE_API_KEY", "CRON_SECRET"];

function knownSecrets(): string[] {
  return SECRET_VARIABLES.flatMap((name) => {
    const value = process.env[name];
    // La clé Firebase peut apparaître avec ses « \n » littéraux ou avec de vrais retours à la ligne.
    return value ? [value, value.replace(/\\n/g, "\n")] : [];
  });
}

/** Journalise une erreur sans l'objet d'origine : nom, code et message expurgé uniquement. */
export function logServerError(scope: string, error: unknown, context = ""): void {
  const secrets = knownSecrets();
  // Le contexte peut contenir une valeur reçue de l'extérieur (identifiant de paiement) : expurgé et tronqué aussi.
  const safeContext = context ? ` ${redactSecrets(context, secrets).replace(/\s+/g, " ").slice(0, 100)}` : "";
  console.error(`[${scope}]${safeContext} ${describeError(error, secrets)}`);
}
