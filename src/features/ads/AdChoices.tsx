"use client";

import { useSyncExternalStore } from "react";
import { useTranslation } from "@/i18n/I18nProvider";
import { isNativeApp } from "@/services/ads/admob";
import { useModal } from "@/ui/modal/ModalProvider";
import { secondaryButton } from "@/ui/styles";
import { useAds } from "./AdsProvider";

const noSubscription = () => () => {};

/**
 * Annonces de l'application Android, dans la gestion des consentements.
 * Le bouton rouvre le formulaire de Google quand UMP l'exige pour un adulte (Espace économique européen, Royaume-Uni, Suisse).
 */
export function AdChoices() {
  const { t } = useTranslation();
  const modal = useModal();
  const ads = useAds();
  const native = useSyncExternalStore(noSubscription, isNativeApp, () => false);
  if (!native) return null;

  const open = async () => {
    try {
      await ads?.openPrivacyOptions();
    } catch (error) {
      await modal.error(error);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
      <h2 className="font-display text-xl font-semibold">{t("privacy.adChoices.title")}</h2>
      <p className="text-ink-soft">{t("privacy.adChoices.body")}</p>
      {ads?.consent?.privacyOptionsRequired && (
        <button type="button" onClick={open} className={`${secondaryButton} self-start`}>
          {t("privacy.adChoices.action")}
        </button>
      )}
    </section>
  );
}
