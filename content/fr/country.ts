import type { CountryConfig } from "../../src/engine/types.ts";

export const country: CountryConfig = {
  code: "fr",
  appName: "GéoFR",
  androidPackage: "fr.javachrist.geofr",
  locales: ["fr"],
  defaultLocale: "fr",
  regionCount: 18,
  legal: { kitAppId: "geofr", supportEmail: "support@appsgeo.com" },
  icons: {
    favicon: "/favicon.ico",
    faviconSvg: "/favicon.svg",
    apple: "/logo180.png",
    icon192: "/logo192.png",
    icon512: "/logo512.png",
  },
  themeColor: "#0a1f44",
  backgroundColor: "#061530",
  timeZone: "Europe/Paris",
  // Catalogue du gestionnaire JavaChrist-Promotions, hébergé dans le projet Firebase de Motissimo, pas dans celui de GéoFR.
  promotions: { catalogProjectId: "motissimo-456ba", sourceAppId: "geofr", locale: "fr" },
  // Bannière AdMob de l'application Android : ID de démonstration Google uniquement, tant que rien n'est validé.
  ads: { admob: { androidBannerAdUnitId: "ca-app-pub-3940256099942544/9214589741" } },
};
