import { readFileSync } from "node:fs";
import type { CapacitorConfig } from "@capacitor/cli";

// Application Android d'un pays de la collection : `GEO_COUNTRY` choisit content/<pays>/android.json, `fr` par défaut.
// Le même fichier est lu par android/app/build.gradle (identifiant d'application AdMob).
const country = process.env.GEO_COUNTRY ?? "fr";
if (!/^[a-z]{2}$/.test(country)) throw new Error(`GEO_COUNTRY invalide : "${country}"`);
const android = JSON.parse(readFileSync(`content/${country}/android.json`, "utf8")) as { applicationId: string; appName: string };

const config: CapacitorConfig = {
  appId: android.applicationId,
  appName: android.appName,
  // Export statique de Next.js : `npm run build:export`.
  webDir: "out",
};

export default config;
