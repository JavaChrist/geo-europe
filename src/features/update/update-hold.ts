"use client";

import { useEffect, useSyncExternalStore } from "react";

// Une partie non terminée n'est pas enregistrée : la mise à jour attend qu'elle soit finie.
let holds = 0;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const isHeld = () => holds > 0;

export function useIsUpdateHeld(): boolean {
  return useSyncExternalStore(subscribe, isHeld, () => false);
}

/** À appeler dans un écran de jeu, avec `true` tant qu'une partie est en cours. */
export function useHoldUpdate(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    holds += 1;
    notify();
    return () => {
      holds -= 1;
      notify();
    };
  }, [active]);
}
