"use client";

import { ExternalLink, Play, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type SyntheticEvent } from "react";
import { PROMO_RULES, type PromoCampaign } from "@/engine/promotions";
import { useHoldUpdate } from "@/features/update/update-hold";
import { useTranslation } from "@/i18n/I18nProvider";
import { primaryButton } from "@/ui/styles";

interface PromoPlayerProps {
  campaign: PromoCampaign;
  onClose: () => void;
}

const ROUND_BUTTON =
  "inline-flex size-12 items-center justify-center rounded-full border border-gold/40 bg-abyss/80 text-ink transition-colors hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/**
 * Vidéo verticale de 15 s au plus, entre deux parties seulement.
 * Elle démarre sans le son quand le navigateur l'autorise ; le son reste au choix du joueur.
 * La fermeture apparaît à la fin, et plus tôt en cas d'erreur, de blocage ou de passage en arrière-plan.
 */
export function PromoPlayer({ campaign, onClose }: PromoPlayerProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [failed, setFailed] = useState(false);
  const [closable, setClosable] = useState(false);
  const closableRef = useRef(false);
  useHoldUpdate(true);

  const limitMs = Math.min(PROMO_RULES.maxDurationMs, campaign.durationMs);
  const values = { name: campaign.name };

  const allowClose = () => {
    if (closableRef.current) return;
    closableRef.current = true;
    setClosable(true);
  };

  const stop = () => {
    videoRef.current?.pause();
    allowClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const video = videoRef.current;
    video?.play().catch(() => setNeedsTap(true));

    // Secours : aucune image après quelques secondes, ou durée maximale dépassée quoi qu'il arrive.
    const stall = window.setTimeout(() => {
      if (!video || video.paused || video.readyState < 3) allowClose();
    }, PROMO_RULES.stallMs);
    const hard = window.setTimeout(() => {
      videoRef.current?.pause();
      allowClose();
    }, PROMO_RULES.hardLimitMs);
    // Application en arrière-plan : la vidéo s'arrête et peut être fermée au retour.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        videoRef.current?.pause();
        allowClose();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(stall);
      window.clearTimeout(hard);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (closable) closeRef.current?.focus();
  }, [closable]);

  const onTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    if (event.currentTarget.currentTime * 1000 >= limitMs) stop();
  };

  const onError = () => {
    setFailed(true);
    allowClose();
  };

  const playByTap = () => {
    const video = videoRef.current;
    if (!video) return;
    setNeedsTap(false);
    video.play().catch(onError);
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !muted;
    setMuted(!muted);
    if (video.paused && !closableRef.current) playByTap();
  };

  const openDestination = () => {
    window.open(campaign.destinationUrl, "_blank", "noopener,noreferrer");
  };

  const close = () => {
    videoRef.current?.pause();
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Échap ou bouton retour : seulement quand la fermeture est proposée.
        if (!closableRef.current) event.preventDefault();
      }}
      onClose={onClose}
      className="promo m-0 h-dvh max-h-none w-screen max-w-none bg-abyss/95 p-0 text-ink"
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <p id={titleId} className="text-sm text-ink-soft">
            {t("promo.label", values)}
          </p>
          {closable && (
            <button ref={closeRef} type="button" onClick={close} className={ROUND_BUTTON} aria-label={t("promo.close")}>
              <X aria-hidden className="size-6" />
            </button>
          )}
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <video
            ref={videoRef}
            src={campaign.videoUrl}
            muted={muted}
            playsInline
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            aria-label={t("promo.dialogLabel", values)}
            onPlaying={() => setStarted(true)}
            onTimeUpdate={onTimeUpdate}
            onEnded={stop}
            onError={onError}
            className="aspect-[9/16] max-h-full w-auto max-w-full rounded-2xl border border-gold/25 bg-black object-contain"
          />
          {needsTap && !failed && !closable && (
            <button type="button" onClick={playByTap} className={`${ROUND_BUTTON} absolute size-16`} aria-label={t("promo.play")}>
              <Play aria-hidden className="size-8" />
            </button>
          )}
          {failed && (
            <p role="status" className="absolute inset-x-4 rounded-xl bg-surface/90 p-4 text-center text-ink-soft">
              {t("promo.unavailable")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!failed && (
            <button
              type="button"
              onClick={toggleSound}
              disabled={closable && !started}
              className={ROUND_BUTTON}
              aria-label={t(muted ? "promo.soundOn" : "promo.soundOff")}
              aria-pressed={!muted}
            >
              {muted ? <VolumeX aria-hidden className="size-6" /> : <Volume2 aria-hidden className="size-6" />}
            </button>
          )}
          <button type="button" onClick={openDestination} className={`${primaryButton} flex-1`}>
            <ExternalLink aria-hidden className="size-5" />
            {t("promo.cta", values)}
          </button>
        </div>
      </div>
    </dialog>
  );
}
