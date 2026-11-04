import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Le pays est choisi au build : tout le reste du code est commun à la collection.
const country = process.env.GEO_COUNTRY ?? "fr";
if (!/^[a-z]{2}$/.test(country) || !existsSync(`content/${country}/index.ts`)) {
  throw new Error(`GEO_COUNTRY invalide ou contenu absent : "${country}"`);
}

// Export statique pour Capacitor : ni serveur ni webhook, donc les fichiers *.server.ts sont ignorés.
const staticExport = process.env.BUILD_TARGET === "export";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: staticExport ? ["tsx", "ts"] : ["tsx", "ts", "server.ts"],
  turbopack: {
    resolveAlias: {
      "@country": `./content/${country}/index.ts`,
    },
  },
  ...(staticExport && { output: "export" as const, images: { unoptimized: true } }),
};

export default nextConfig;
