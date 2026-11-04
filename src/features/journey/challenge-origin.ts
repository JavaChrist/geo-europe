/** Le chemin par lequel le joueur est entré dans un défi. La page du défi reste la même : seul son retour change. */
export type ChallengeOrigin = "defis" | "parcours";

export const ORIGIN_PARAM = "from";

export const challengeEntryHref = (path: string, origin: ChallengeOrigin): string => `${path}?${ORIGIN_PARAM}=${origin}`;

export const challengeListPath = (slug: string): string => `/defis/${slug}`;

// Perdu au rechargement, volontairement : seule une entrée par un lien de l'app garantit que l'écran précédent lui appartient.
let enteredFromApp = false;

export const markChallengeEntry = (): void => {
  enteredFromApp = true;
};

export const canReturnThroughHistory = (): boolean => enteredFromApp;
