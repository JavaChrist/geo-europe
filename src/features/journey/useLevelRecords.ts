"use client";

import { useSyncExternalStore } from "react";
import content from "@country";
import type { ChallengeRecord } from "@/engine/special-challenges";
import { type LevelRecords, readChallengeRecords, readLevelRecords, subscribeToLevelRecords } from "@/services/local-progress";

const NOTHING_ON_SERVER: LevelRecords = {};
const readRecords = () => readLevelRecords(content.country.code);
const readServerRecords = () => NOTHING_ON_SERVER;
const NO_CHALLENGES_ON_SERVER: Record<string, ChallengeRecord> = {};
const readChallenges = () => readChallengeRecords(content.country.code);
const readServerChallenges = () => NO_CHALLENGES_ON_SERVER;

/** Résultats enregistrés sur cet appareil. Vide au rendu serveur, puis à jour dès l'hydratation. */
export function useLevelRecords(): LevelRecords {
  return useSyncExternalStore(subscribeToLevelRecords, readRecords, readServerRecords);
}

/** Résultats des défis spéciaux sur cet appareil, avec la même hydratation. */
export function useChallengeRecords(): Record<string, ChallengeRecord> {
  return useSyncExternalStore(subscribeToLevelRecords, readChallenges, readServerChallenges);
}
