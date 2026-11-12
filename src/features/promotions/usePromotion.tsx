"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import content from "@country";
import { isPromoDue, mayFetchCatalog, pickCampaign, PROMO_RULES, promotionsAllowed, type AdultAnswer, type PromoAccess, type PromoCampaign } from "@/engine/promotions";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useHideAdBanner } from "@/features/ads/AdsProvider";
import { loadCampaigns, readPromoState, recordAdultAnswer, recordGameCompleted, recordPromoShown } from "@/services/promotions";
import { useModalBusy } from "@/ui/modal/ModalProvider";
import { AgeQuestion } from "./AgeQuestion";
import { PromoPlayer } from "./PromoPlayer";

type Step = { kind: "idle" } | { kind: "ask" } | { kind: "play"; campaign: PromoCampaign };

const IDLE: Step = { kind: "idle" };

interface PromotionContext {
  /** Partie terminée sur un écran de jeu. `sharedDevice` : compte pour la fréquence, n'ouvre rien. */
  gameCompleted: (sharedDevice: boolean) => void;
  /** Écran qui interdit toute promotion tant qu'il est affiché : partie en cours, ou mode Famille. */
  block: (sharedDevice: boolean) => () => void;
}

const Context = createContext<PromotionContext | null>(null);

/**
 * Promotions JavaChrist entre deux parties (voir `docs/promotions.md`), au niveau de l'application.
 * Une promotion due survit à la navigation : quitter l'écran de résultats tout de suite ne la perd plus, elle s'ouvre
 * au premier moment calme (aucune partie en cours, aucune modale, hors mode Famille), sur l'écran suivant.
 */
export function PromotionProvider({ children }: { children: ReactNode }) {
  const { entitlements, status } = useEntitlements();
  const modalBusy = useModalBusy();
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<Step>(IDLE);
  const [playing, setPlaying] = useState(0);
  const [shared, setShared] = useState(0);
  const config = content.country.promotions;
  const code = content.country.code;
  const access: PromoAccess = { configured: config !== null, entitlementsReady: status !== "loading", adsRemoved: entitlements.adsRemoved };
  const allowed = promotionsAllowed(access);
  const blocked = playing > 0 || shared > 0;

  // Catalogue lu à l'avance, pour que la vidéo démarre sans attente. Seulement pour un adulte déclaré, hors mode Famille.
  useEffect(() => {
    if (!config || !allowed || shared > 0 || !mayFetchCatalog(access, readPromoState(code))) return;
    void loadCampaigns(code, config);
    // `access` se résume à `allowed` ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, code, config, shared]);

  const gameCompleted = useCallback(
    (sharedDevice: boolean) => {
      const state = recordGameCompleted(code);
      // Mode Famille : la partie compte, mais rien ne s'ouvre, ni pendant le mode ni en le quittant.
      if (sharedDevice) return;
      if (isPromoDue(state) && state.adult !== "minor") setPending(true);
    },
    [code],
  );

  const block = useCallback((sharedDevice: boolean) => {
    const set = sharedDevice ? setShared : setPlaying;
    set((count) => count + 1);
    // Entrer en mode Famille annule une promotion en attente : un enfant peut tenir l'appareil.
    if (sharedDevice) {
      setPending(false);
      setStep(IDLE);
    }
    return () => set((count) => count - 1);
  }, []);

  const showCampaign = useCallback(async () => {
    if (!config) return;
    const state = readPromoState(code);
    const campaign = pickCampaign(await loadCampaigns(code, config), state.lastShownId, Math.random);
    // Aucune campagne (catalogue vide, réseau absent) : le compteur reste prêt pour la prochaine partie.
    if (!campaign) return;
    recordPromoShown(code, campaign.id);
    setStep({ kind: "play", campaign });
  }, [code, config]);

  useEffect(() => {
    if (!pending || modalBusy || blocked) return;
    const timer = window.setTimeout(() => {
      setPending(false);
      // Droits relus au dernier moment : un achat sans publicités pendant l'attente annule tout.
      if (!allowed) return;
      const state = readPromoState(code);
      if (!isPromoDue(state) || state.adult === "minor") return;
      if (state.adult === null) setStep({ kind: "ask" });
      else void showCampaign();
    }, PROMO_RULES.resultDelayMs);
    return () => window.clearTimeout(timer);
  }, [pending, modalBusy, blocked, allowed, code, showCampaign]);

  // « Plus tard » : pas de réponse, la question revient à la prochaine partie terminée.
  const answer = (value: AdultAnswer) => {
    setStep(IDLE);
    if (value === null) return;
    recordAdultAnswer(code, value);
    if (value === "adult") void showCampaign();
  };

  // Bannière AdMob masquée pendant la question d'âge et la vidéo : une vue native passerait au-dessus.
  useHideAdBanner(step.kind !== "idle");

  const overlay =
    shared > 0 ? null : step.kind === "ask" ? (
      <AgeQuestion onAnswer={answer} />
    ) : step.kind === "play" ? (
      <PromoPlayer key={step.campaign.id} campaign={step.campaign} onClose={() => setStep(IDLE)} />
    ) : null;

  return (
    <Context.Provider value={{ gameCompleted, block }}>
      {children}
      {overlay}
    </Context.Provider>
  );
}

interface Promotion {
  /** À appeler une seule fois par partie réellement terminée, après l'enregistrement du résultat. */
  gameCompleted: () => void;
}

/**
 * Raccorde un écran de jeu aux promotions.
 * `playing` : une partie est en cours. Rien ne s'ouvre alors, et rien ne s'ouvre avant la fin des modales de résultat.
 * `sharedDevice` : mode Famille, un enfant peut jouer sur l'appareil d'un adulte. Aucune question d'âge, aucune vidéo
 * ni requête du catalogue tant que l'écran est affiché, résultats et fin de partie compris, ni en le quittant.
 * La partie terminée compte quand même dans la fréquence.
 */
export function usePromotion(playing: boolean, { sharedDevice = false }: { sharedDevice?: boolean } = {}): Promotion {
  const context = useContext(Context);
  if (!context) throw new Error("usePromotion doit être utilisé sous PromotionProvider");
  const { block, gameCompleted } = context;

  // Bannière AdMob masquée pendant la partie : une vue native passerait au-dessus.
  useHideAdBanner(playing);

  const holds = playing || sharedDevice;
  useEffect(() => (holds ? block(sharedDevice) : undefined), [holds, sharedDevice, block]);

  return { gameCompleted: useCallback(() => gameCompleted(sharedDevice), [gameCompleted, sharedDevice]) };
}
