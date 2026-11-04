import type { LegalHost, LegalPublisher } from "../../src/engine/types.ts";

/** Éditeur commun aux applications de la collection Géo Europe. */
export const publisher: LegalPublisher = {
  tradeName: "JavaChrist",
  entrepreneur: "Christian Grohens",
  status: "Entrepreneur individuel (EI)",
  siren: "338 593 312",
  siret: "338 593 312 00030",
  registry: "RCS Toulouse",
  address: "5 rue Maurice Fonvieille, 31120 Portet-sur-Garonne, France",
  director: "Christian Grohens",
  phone: "09 52 62 31 71",
  supportEmail: "support@appsgeo.com",
  website: "https://appsgeo.com",
};

/** Hébergeur des versions web. Adresse vérifiée sur vercel.com/legal/privacy-policy, version du 1er juin 2026. */
export const webHost: LegalHost = {
  name: "Vercel Inc.",
  address: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
  website: "https://vercel.com",
};
