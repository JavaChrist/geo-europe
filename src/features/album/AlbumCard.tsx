"use client";

import { Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import content from "@country";
import { isCardEarned } from "@/engine/album";
import type { SouvenirCard } from "@/engine/types";
import { regionSlugOf, territoryPath } from "@/features/journey/territories";
import { useLevelRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import { cardPath, levelOfCard, territoryOfCard } from "./collections";

const TILE_CLASS =
  "flex h-full flex-col overflow-hidden rounded-2xl border bg-surface/50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/** Carte acquise : photo et titre. Carte masquée : seulement le niveau qui la donne. */
export function AlbumCard({ card }: { card: SouvenirCard }) {
  const { t, tContent } = useTranslation();
  const records = useLevelRecords();
  const territory = territoryOfCard(card);
  const level = levelOfCard(card);
  const credit = content.credits.find((candidate) => candidate.id === card.mediaId);
  if (!territory || !level || !credit) return null;

  if (!isCardEarned(card, records)) {
    return (
      <Link href={territoryPath(regionSlugOf(territory), territory.slug)} className={`${TILE_CLASS} border-gold/15 hover:border-gold/40`}>
        <span className="flex aspect-[4/3] items-center justify-center bg-abyss/50">
          <Lock aria-hidden className="size-7 text-ink-soft" />
        </span>
        <span className="flex flex-col gap-1 p-3">
          <span className="font-semibold">{t("album.hidden.title")}</span>
          <span className="text-sm text-ink-soft">
            {t("album.hidden.hint", { level: tContent(level.nameKey), territory: tContent(territory.nameKey) })}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={cardPath(card)} className={`${TILE_CLASS} border-gold/40 hover:border-gold`}>
      <span className="relative block aspect-[4/3]">
        <Image
          src={credit.file}
          alt={credit.altKey ? tContent(credit.altKey) : ""}
          fill
          sizes="(min-width: 640px) 208px, 50vw"
          className="object-cover"
        />
      </span>
      <span className="flex flex-col gap-1 p-3">
        <span className="font-semibold">{tContent(card.nameKey)}</span>
        <span className="text-sm text-gold">{t(`album.themes.${card.themeId}`)}</span>
      </span>
    </Link>
  );
}
