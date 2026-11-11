"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
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

interface Promotion {
  /** À appeler une seule fois par partie réellement terminée, après l'enregistrement du résultat. */
  gameCompleted: () => void;
  /** Question d'âge ou vidéo, à placer dans l'écran de jeu. */
  overlay: ReactNode;
}

/**
 * Promotions JavaChrist entre deux parties (voir `docs/promotions.md`).
 * `playing` : une partie est en cours. Rien ne s'ouvre alors, et rien ne s'ouvre avant la fin des modales de résultat.
 * `sharedDevice` : mode Famille, un enfant peut jouer sur l'appareil d'un adulte. Aucune question d'âge, aucune vidéo
 * ni requête du catalogue, résultats et fin de partie compris. La partie terminée compte quand même dans la fréquence.
 */
export function usePromotion(playing: boolean, { sharedDevice = false }: { sharedDevice?: boolean } = {}): Promotion {
  const { entitlements, status } = useEntitlements();
  const modalBusy = useModalBusy();
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<Step>(IDLE);
  const config = content.country.promotions;
  const code = content.country.code;
  const access: PromoAccess = { configured: config !== null, entitlementsReady: status !== "loading", adsRemoved: entitlements.adsRemoved };
  const allowed = promotionsAllowed(access) && !sharedDevice;

  // Catalogue lu à l'avance, pour que la vidéo démarre sans attente. Seulement pour un adulte déclaré.
  useEffect(() => {
    if (!config || !allowed || !mayFetchCatalog(access, readPromoState(code))) return;
    void loadCampaigns(code, config);
    // `access` se résume à `allowed` ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, code, config]);

  const gameCompleted = useCallback(() => {
    const state = recordGameCompleted(code);
    if (allowed && isPromoDue(state) && state.adult !== "minor") setPending(true);
  }, [allowed, code]);

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
    if (!pending || modalBusy || playing) return;
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
  }, [pending, modalBusy, playing, allowed, code, showCampaign]);

  const answer = (value: AdultAnswer) => {
    setStep(IDLE);
    if (value === null) return;
    recordAdultAnswer(code, value);
    if (value === "adult") void showCampaign();
  };

  // Bannière AdMob masquée pendant la partie, la question d'âge et la vidéo : une vue native passerait au-dessus.
  useHideAdBanner(playing || step.kind !== "idle");

  const overlay =
    sharedDevice ? null : step.kind === "ask" ? (
      <AgeQuestion onAnswer={answer} />
    ) : step.kind === "play" ? (
      <PromoPlayer key={step.campaign.id} campaign={step.campaign} onClose={() => setStep(IDLE)} />
    ) : null;

  return { gameCompleted, overlay };
}
