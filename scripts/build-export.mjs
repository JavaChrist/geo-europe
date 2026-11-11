// Export statique destiné à Capacitor, sans dépendance pour passer la variable sous Windows.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import nextEnv from "@next/env";

const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: { ...process.env, BUILD_TARGET: "export" },
});
if (result.status !== 0) process.exit(result.status ?? 1);

// Même lecture des variables que Next (fichiers .env compris), sans en afficher aucune.
nextEnv.loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const payments = apiBase ? "play" : "off";

// Marqueur lu par Gradle : un AAB ou un APK release sans serveur (canal `off`, ni compte ni Boutique) est refusé.
// Voir docs/admob.md, section Variantes du build.
writeFileSync("out/geo-export.json", `${JSON.stringify({ payments, apiBase }, null, 2)}\n`);
if (payments === "off") {
  console.warn("\nExport sans NEXT_PUBLIC_API_BASE_URL : canal de paiement off, ni compte ni Boutique. Gradle refusera un build release.");
}
