"use client";

import { createContext, use, useMemo, useRef, useState, type ReactNode } from "react";
import { toAppError } from "@/services/app-error";
import { ModalDialog } from "./ModalDialog";
import type { ModalApi, ModalContent, ModalRequest, ModalVariant } from "./types";

const ModalContext = createContext<ModalApi | null>(null);
// Vrai tant qu'une modale est ouverte ou attend : un écran par-dessus le jeu (promotion) attend son tour.
const ModalBusyContext = createContext(false);

export function ModalProvider({ children }: { children: ReactNode }) {
  // File d'attente : une seule modale à la fois, les suivantes s'ouvrent à la fermeture.
  const [queue, setQueue] = useState<ModalRequest[]>([]);
  const nextId = useRef(0);

  const api = useMemo<ModalApi>(() => {
    const open = (variant: ModalVariant, content: ModalContent, needsChoice: boolean) =>
      new Promise<boolean>((resolve) => {
        const id = nextId.current++;
        setQueue((current) => [...current, { id, variant, content, needsChoice, resolve }]);
      });
    const notify = (variant: ModalVariant, content: ModalContent) => open(variant, content, false).then(() => undefined);

    return {
      info: (content) => notify("info", content),
      success: (content) => notify("success", content),
      reward: (content) => notify("reward", content),
      error: (error) => {
        const { code } = toAppError(error);
        return notify("error", { titleKey: `errors.${code}.title`, bodyKey: `errors.${code}.body` });
      },
      confirm: (content) => open("confirm", content, true),
      destructive: (content) => open("destructive", content, true),
      purchase: (content) => open("purchase", content, true),
    };
  }, []);

  const current = queue[0];

  const handleSettled = (confirmed: boolean) => {
    current?.resolve(confirmed);
    setQueue((pending) => pending.slice(1));
  };

  return (
    <ModalContext value={api}>
      <ModalBusyContext value={queue.length > 0}>
        {children}
        {current && <ModalDialog key={current.id} request={current} onSettled={handleSettled} />}
      </ModalBusyContext>
    </ModalContext>
  );
}

export function useModal(): ModalApi {
  const api = use(ModalContext);
  if (!api) throw new Error("useModal doit être utilisé dans ModalProvider");
  return api;
}

export function useModalBusy(): boolean {
  return use(ModalBusyContext);
}
