"use client";

import Image from "next/image";
import content from "@country";
import { useTranslation } from "@/i18n/I18nProvider";
import { PhotoCredit } from "@/ui/PhotoCredit";

/** Couverture d'une fiche de région ou de territoire, toujours accompagnée de son crédit. */
export function CoverPhoto({ mediaId }: { mediaId: string }) {
  const { tContent } = useTranslation();
  const credit = content.credits.find((candidate) => candidate.id === mediaId);
  if (!credit?.width || !credit.height) return null;

  return (
    <figure className="flex flex-col gap-2">
      <Image
        src={credit.file}
        alt={credit.altKey ? tContent(credit.altKey) : ""}
        width={credit.width}
        height={credit.height}
        sizes="(min-width: 672px) 640px, 100vw"
        loading="eager"
        className="h-auto w-full"
      />
      <PhotoCredit credit={credit} className="px-5" />
    </figure>
  );
}
