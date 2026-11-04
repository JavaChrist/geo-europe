"use client";

import { Star } from "lucide-react";
import type { StarCount } from "@/engine/level-run";
import { useTranslation } from "@/i18n/I18nProvider";

const POSITIONS = [1, 2, 3] as const;

export function StarRating({ count, large = false }: { count: StarCount; large?: boolean }) {
  const { t } = useTranslation();
  const size = large ? "size-10" : "size-5";

  return (
    <span role="img" aria-label={t("journey.stars", { count })} className="inline-flex items-center gap-1">
      {POSITIONS.map((position) => (
        <Star
          key={position}
          aria-hidden
          className={`${size} ${position <= count ? "fill-gold text-gold" : "text-ink-soft/50"}`}
        />
      ))}
    </span>
  );
}
