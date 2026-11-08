/**
 * Description d'une erreur pour les journaux du serveur, sans aucun secret.
 *
 * Seuls le nom, le code et le message sont gardés, jamais l'objet entier : une erreur de bibliothèque peut
 * transporter la requête d'origine, ses en-têtes (`Authorization`) ou la configuration du client.
 * Le message lui-même est expurgé des jetons, clés privées, clés d'API et liens d'action.
 */
const MAX_MESSAGE = 300;
const MASK = "[masqué]";

const PATTERNS: RegExp[] = [
  // Clé privée au format PEM, entière ou tronquée.
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  // Jeton porteur dans un en-tête recopié.
  /\bBearer\s+[^\s"',;]+/gi,
  // Jeton JWT, dont les jetons d'identité Firebase.
  /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/g,
  // Clés Mollie.
  /\b(live|test|access)_[A-Za-z0-9]{20,}\b/g,
  // Codes d'action Firebase (vérification, mot de passe) et paramètres sensibles d'une adresse.
  /\b(oobCode|apiKey|token|access_token|id_token|refresh_token|password|secret)=[^&\s"']+/gi,
];

/** Remplace dans `text` tout ce qui ressemble à un secret, ainsi que les secrets connus passés en argument. */
export function redactSecrets(text: string, knownSecrets: readonly (string | undefined)[] = []): string {
  let result = text;
  for (const secret of knownSecrets) {
    // Les valeurs trop courtes donneraient de faux remplacements partout.
    if (secret && secret.length >= 8) result = result.split(secret).join(MASK);
  }
  for (const pattern of PATTERNS) result = result.replace(pattern, MASK);
  return result;
}

/** `Nom (code) : message`, expurgé et tronqué. Rien d'autre de l'erreur n'est lu. */
export function describeError(error: unknown, knownSecrets: readonly (string | undefined)[] = []): string {
  if (typeof error !== "object" || error === null) return redactSecrets(String(error), knownSecrets).slice(0, MAX_MESSAGE);
  const name = "name" in error && typeof error.name === "string" ? error.name : "Error";
  const code = "code" in error && (typeof error.code === "string" || typeof error.code === "number") ? String(error.code) : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const head = code ? `${name} (${code})` : name;
  const safe = redactSecrets(message, knownSecrets);
  return redactSecrets(safe ? `${head} : ${safe}` : head, knownSecrets).slice(0, MAX_MESSAGE);
}
