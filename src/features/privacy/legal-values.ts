import content from "@country";

/** Valeurs insérées dans les textes des rubriques locales. Les documents juridiques viennent du kit, pas d'ici. */
export function getLegalValues() {
  const { appName, legal } = content.country;
  return { appName, contact: legal.supportEmail };
}
