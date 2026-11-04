"use client";

import { Lock } from "lucide-react";
import Image from "next/image";
import content from "@country";
import { isCardEarned } from "@/engine/album";
import { useLevelRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import { BackLink } from "@/ui/BackLink";
import { PhotoCredit } from "@/ui/PhotoCredit";
import { allCards, levelOfCard, territoryOfCard } from "./collections";

/** Une carte encore masquée ne révèle rien, même en ouvrant son adresse directement. */
export function CardDetail({ cardId }: { cardId: string }) {
  const { t, tContent } = useTranslation();
  const records = useLevelRecords();
  const card = allCards.find((candidate) => candidate.id === cardId);
  const territory = card && territoryOfCard(card);
  const level = card && levelOfCard(card);
  const credit = card && content.credits.find((candidate) => candidate.id === card.mediaId);
  if (!card || !territory || !level || !credit?.width || !credit.height) return null;

  const back = <BackLink href="/album" label={t("album.detail.back")} />;

  if (!isCardEarned(card, records)) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        <section className="fade-in flex flex-col items-center gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-8 text-center">
          <Lock aria-hidden className="size-8 text-ink-soft" />
          <h1 className="font-display text-2xl font-semibold">{t("album.hidden.title")}</h1>
          <p className="text-ink-soft">{t("album.hidden.hint", { level: tContent(level.nameKey), territory: tContent(territory.nameKey) })}</p>
        </section>
        {back}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <article className="fade-in flex flex-col gap-4 overflow-hidden rounded-3xl border border-gold/40 bg-surface/60 pb-5">
        <figure className="flex flex-col gap-2">
          <Image
            src={credit.file}
            alt={credit.altKey ? tContent(credit.altKey) : ""}
            width={credit.width}
            height={credit.height}
            sizes="(min-width: 672px) 640px, 100vw"
            loading="eager"
            className="h-auto max-h-[65vh] w-full bg-abyss/40 object-contain"
          />
          <PhotoCredit credit={credit} className="px-5" />
        </figure>
        <div className="flex flex-col gap-3 px-5">
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="rounded-full border border-gold/30 px-3 py-1 text-gold">{tContent(territory.nameKey)}</li>
            <li className="rounded-full border border-gold/30 px-3 py-1 text-gold">{t(`album.themes.${card.themeId}`)}</li>
          </ul>
          <h1 className="font-display text-3xl font-semibold">{tContent(card.nameKey)}</h1>
          <p>{tContent(card.descriptionKey)}</p>
          <section className="flex flex-col gap-1 rounded-2xl border border-gold/15 bg-abyss/30 p-4">
            <h2 className="font-display text-lg font-semibold text-gold">{t("album.detail.anecdote")}</h2>
            <p className="text-ink-soft">{tContent(card.anecdoteKey)}</p>
          </section>
          <p className="text-sm text-ink-soft">{t("album.detail.earnedBy", { level: tContent(level.nameKey) })}</p>
        </div>
      </article>
      {back}
    </main>
  );
}
