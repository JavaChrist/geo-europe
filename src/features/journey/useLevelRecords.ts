"use client";

import { useSyncExternalStore } from "react";
import content from "@country";
import { type LevelRecords, readLevelRecords, subscribeToLevelRecords } from "@/services/local-progress";

const NOTHING_ON_SERVER: LevelRecords = {};
const readRecords = () => readLevelRecords(content.country.code);
const readServerRecords = () => NOTHING_ON_SERVER;

/** Résultats enregistrés sur cet appareil. Vide au rendu serveur, puis à jour dès l'hydratation. */
export function useLevelRecords(): LevelRecords {
  return useSyncExternalStore(subscribeToLevelRecords, readRecords, readServerRecords);
}
