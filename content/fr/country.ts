import type { CountryConfig } from "../../src/engine/types.ts";
import { publisher, webHost } from "../_shared/legal.ts";

export const country: CountryConfig = {
  code: "fr",
  appName: "GéoFR",
  androidPackage: "fr.javachrist.geofr",
  locales: ["fr"],
  defaultLocale: "fr",
  regionCount: 18,
  premium: { priceCents: 499, currency: "EUR" },
  legal: {
    publisher,
    host: webHost,
    vat: { regime: "franchise", confirmed: false },
    mediator: {
      name: "Médiation Consommation Développement",
      address: "Centre d'Affaires Stéphanois, Immeuble l'Horizon, Esplanade de France, 3 rue J. Constant Milleret, 42000 Saint-Étienne",
      website: "https://www.medconsodev.eu/",
      confirmed: true,
    },
    documentsUpdatedAt: "2026-11-04",
  },
  icons: {
    favicon: "/favicon.ico",
    faviconSvg: "/favicon.svg",
    apple: "/logo180.png",
    icon192: "/logo192.png",
    icon512: "/logo512.png",
  },
  themeColor: "#0a1f44",
  backgroundColor: "#061530",
};
