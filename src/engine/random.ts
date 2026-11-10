/** Hasard injecté : le moteur reste reproductible dans les contrôles. */
export type RandomSource = () => number;

export function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** Empreinte FNV-1a d'un texte, sur 32 bits. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Hasard reproductible tiré d'un texte (mulberry32) : le même texte rend toujours la même suite.
 * Sert aux tirages communs à tous les joueurs, comme celui du Défi du jour.
 */
export function seededRandom(seed: string): RandomSource {
  let state = hashOf(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
