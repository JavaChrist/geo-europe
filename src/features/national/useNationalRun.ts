"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import content from "@country";
import type { LevelRun } from "@/engine/level-run";
import { usePromotion } from "@/features/promotions/usePromotion";
import { useHoldUpdate } from "@/features/update/update-hold";
import { clearPausedRun, readPausedRun, savePausedRun, subscribeToPausedRuns } from "@/services/paused-runs";
import { useLeaveGuard } from "@/ui/nav/leave-guard";

/**
 * Ce que partagent les écrans de jeu des défis nationaux : partie gardée à chaque étape, sortie protégée,
 * pas de modale de mise à jour ni de vidéo pendant la partie. Aucun défi national n'a de chronomètre.
 */
export function useNationalRun(runKey: string, backHref: string) {
  const [run, setRun] = useState<LevelRun | null>(null);
  useHoldUpdate(run !== null);
  // Un défi national terminé compte comme un niveau pour les promotions.
  const promotion = usePromotion(run !== null);

  const guard = useLeaveGuard(run !== null, {
    bodyKey: "challenges.national.leaveBody",
    backHref,
    onLeave: () => {
      if (run) savePausedRun(content.country.code, runKey, { run, timer: null });
    },
  });

  const paused = useSyncExternalStore(
    subscribeToPausedRuns,
    () => readPausedRun(content.country.code, runKey),
    () => null,
  );

  useEffect(() => {
    if (!run) return;
    const save = () => savePausedRun(content.country.code, runKey, { run, timer: null });
    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    save();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", save);
    };
  }, [run, runKey]);

  return {
    run,
    setRun,
    /** Partie gardée, à valider par le moteur avant de la proposer. */
    paused: paused?.run ?? null,
    promotion,
    quit: () => void guard.back(),
    /** À appeler avant d'enregistrer le résultat : une partie terminée ne peut plus être reprise. */
    clearPaused: () => clearPausedRun(content.country.code, runKey),
  };
}
