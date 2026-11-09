import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Le pays est choisi au build : tout le reste du code est commun à la collection.
const country = process.env.GEO_COUNTRY ?? "fr";
if (!/^[a-z]{2}$/.test(country) || !existsSync(`content/${country}/index.ts`)) {
  throw new Error(`GEO_COUNTRY invalide ou contenu absent : "${country}"`);
}

// Export statique pour Capacitor : ni serveur ni webhook, donc les fichiers *.server.ts sont ignorés.
const staticExport = process.env.BUILD_TARGET === "export";

// Application Android : serveur HTTPS déployé qui porte les routes (comptes, droits, Google Play). Aucun secret ici.
const apiBase = staticExport ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "") : "";
if (apiBase && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(apiBase)) {
  throw new Error(`NEXT_PUBLIC_API_BASE_URL doit être une origine HTTPS sans chemin : "${apiBase}"`);
}

// Identifiant de la version construite, comparé par l'application pour détecter un nouveau déploiement.
function readBuildId(): string {
  const fromEnv = process.env.GEO_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "local";
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: readBuildId(),
    // Sur Capacitor, les mises à jour passent par le Play Store.
    NEXT_PUBLIC_UPDATE_CHECK: staticExport ? "off" : "on",
    // Canal de paiement (src/services/api.ts) : Mollie sur le web, Google Play dans l'application Android
    // quand un serveur est indiqué, sinon aucun compte ni achat. Jamais Mollie dans l'export.
    NEXT_PUBLIC_PAYMENTS: staticExport ? (apiBase ? "play" : "off") : "web",
    NEXT_PUBLIC_API_BASE_URL: apiBase,
  },
  // Conditions de vente jointes à la confirmation d'achat : lues à l'exécution par les routes de paiement.
  outputFileTracingIncludes: { "/api/payments/*": [`./content/${country}/legal/conditions-vente.md`] },
  pageExtensions: staticExport ? ["tsx", "ts"] : ["tsx", "ts", "server.ts"],
  turbopack: {
    resolveAlias: {
      "@country": `./content/${country}/index.ts`,
      // Modèles de courriels du Mail-Kit, lus uniquement par le serveur.
      "@country-mail": `./content/${country}/mail/templates.json`,
    },
  },
  ...(staticExport && { output: "export" as const, images: { unoptimized: true } }),
};

export default nextConfig;
