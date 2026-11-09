"use client";

import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import content from "@country";
import { canPlayRegion, FREE_ENTITLEMENTS, type Entitlements } from "@/engine/entitlements";
import { paymentsEnabled, requestRestore, watchAccount, watchEntitlements, type Account } from "@/services/account";

/**
 * Couche commune des droits d'accès : tous les verrous du jeu passent par `useEntitlements()`.
 * Les droits viennent uniquement du document écrit par le serveur. Sans compte, hors ligne ou en cas d'erreur,
 * l'accès retombe sur la Découverte gratuite : jamais de droit supposé.
 */
export type EntitlementsStatus = "loading" | "ready" | "offline";

interface EntitlementsState {
  account: Account | null;
  entitlements: Entitlements;
  status: EntitlementsStatus;
  enabled: boolean;
  canPlayRegion: (regionId: string) => boolean;
}

const EntitlementsContext = createContext<EntitlementsState | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const enabled = paymentsEnabled();
  const [account, setAccount] = useState<Account | null | undefined>(enabled ? undefined : null);
  const [remote, setRemote] = useState<{ uid: string; entitlements: Entitlements | null } | null>(null);

  useEffect(() => (enabled ? watchAccount(setAccount) : undefined), [enabled]);

  const uid = account?.uid;
  // Une adresse confirmée après la connexion relance le calcul : un accès offert en attente s'active alors.
  const verified = account?.verified ?? false;
  useEffect(() => {
    if (!uid) return;
    const stop = watchEntitlements(uid, (entitlements) => setRemote({ uid, entitlements }));
    // Recalcul par le serveur à chaque connexion : un achat fait sur un autre appareil revient ici.
    requestRestore().catch(() => undefined);
    return stop;
  }, [uid, verified]);

  const value = useMemo<EntitlementsState>(() => {
    const current = uid && remote?.uid === uid ? remote : null;
    let status: EntitlementsStatus = "ready";
    if (account === undefined || (uid && !current)) status = "loading";
    else if (current && current.entitlements === null) status = "offline";
    const entitlements = current?.entitlements ?? FREE_ENTITLEMENTS;
    return {
      account: account ?? null,
      entitlements,
      status,
      enabled,
      canPlayRegion: (regionId) => canPlayRegion(entitlements, regionId, content.editions),
    };
  }, [account, uid, remote, enabled]);

  return <EntitlementsContext value={value}>{children}</EntitlementsContext>;
}

export function useEntitlements(): EntitlementsState {
  const state = use(EntitlementsContext);
  if (!state) throw new Error("useEntitlements doit être utilisé dans EntitlementsProvider");
  return state;
}
