"use client";

import type { MediaCredit } from "@/engine/types";
import { useTranslation } from "@/i18n/I18nProvider";

const LINK_CLASS = "underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-gold";

/** Auteur et licence d'une photo, avec les liens que sa licence demande. */
export function PhotoCredit({ credit, className = "" }: { credit: MediaCredit; className?: string }) {
  const { t } = useTranslation();

  return (
    <figcaption className={`flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft ${className}`}>
      <a href={credit.source} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {t("journey.game.photoCredit", { author: credit.author })}
      </a>
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {credit.license}
        </a>
      ) : (
        <span>{credit.license}</span>
      )}
    </figcaption>
  );
}
