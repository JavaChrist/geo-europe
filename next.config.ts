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
  },
  pageExtensions: staticExport ? ["tsx", "ts"] : ["tsx", "ts", "server.ts"],
  turbopack: {
    resolveAlias: {
      "@country": `./content/${country}/index.ts`,
    },
  },
  ...(staticExport && { output: "export" as const, images: { unoptimized: true } }),
};

export default nextConfig;
