import type { CountryConfig } from "../../src/engine/types.ts";

export const country: CountryConfig = {
  code: "fr",
  appName: "GéoFR",
  androidPackage: "fr.javachrist.geofr",
  locales: ["fr"],
  defaultLocale: "fr",
  regionCount: 18,
  premium: { priceCents: 499, currency: "EUR" },
  legal: {
    publisher: {
      name: "JavaChrist",
      status: null,
      siret: null,
      address: null,
      director: null,
      contactEmail: null,
    },
    host: { name: "Vercel Inc.", address: null },
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
