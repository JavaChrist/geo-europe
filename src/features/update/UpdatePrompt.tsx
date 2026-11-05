"use client";

import { useEffect, useRef, useState } from "react";
import { CURRENT_BUILD_ID, fetchLatestBuildId, UPDATE_CHECK_ENABLED } from "@/services/app-version";
import { useModal } from "@/ui/modal/ModalProvider";
import { useIsUpdateHeld } from "./update-hold";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Détecte un nouveau déploiement et propose de recharger l'application. */
export function UpdatePrompt() {
  const modal = useModal();
  const held = useIsUpdateHeld();
  const [latest, setLatest] = useState<string | null>(null);
  // « Plus tard » vaut pour cette version jusqu'au prochain lancement ; une version plus récente est reproposée.
  const proposed = useRef<string | null>(null);

  useEffect(() => {
    if (!UPDATE_CHECK_ENABLED) return;
    const check = async () => {
      const buildId = await fetchLatestBuildId();
      if (buildId && buildId !== CURRENT_BUILD_ID) setLatest(buildId);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!latest || held || proposed.current === latest) return;
    proposed.current = latest;
    void modal
      .confirm({
        titleKey: "update.title",
        bodyKey: "update.body",
        confirmKey: "update.confirm",
        cancelKey: "update.later",
      })
      .then((confirmed) => {
        if (confirmed) window.location.reload();
      });
  }, [latest, held, modal]);

  return null;
}
