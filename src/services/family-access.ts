/**
 * Frontière d'accès du Mode Famille. Toujours ouverte pour l'instant : aucun paiement, aucun compte, aucun Premium.
 *
 * Les éditions prévues (Famille avec publicité, Famille sans publicité) sont décrites dans `docs/mode-famille.md`.
 * Le jour où elles existeront, seule cette fonction changera, et l'accès sera vérifié par le serveur,
 * jamais à partir d'un résultat du navigateur.
 */
export type FamilyAccess = { allowed: true };

export function familyAccess(): FamilyAccess {
  return { allowed: true };
}
