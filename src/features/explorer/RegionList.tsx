"use client";

import { ChevronDown, ChevronRight, Lock, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import content from "@country";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { hasPlayableTerritory } from "@/features/journey/territories";
import { useTranslation } from "@/i18n/I18nProvider";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-'’]/g, " ")
    .toLowerCase()
    .trim();

/** Accès complémentaire à la carte, pour l'accessibilité et la recherche. */
export function RegionList() {
  const { t, tContent } = useTranslation();
  const { canPlayRegion, status } = useEntitlements();
  const [query, setQuery] = useState("");
  const inputId = useId();

  const needle = normalize(query);
  const regions = content.regions.filter((region) => normalize(tContent(region.nameKey)).includes(needle));

  return (
    <details className="group rounded-2xl border border-gold/20 bg-surface/50">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 font-semibold focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        {t("explorer.listTitle")}
        <ChevronDown aria-hidden className="size-5 text-gold transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-3 px-4 pb-4">
        <label htmlFor={inputId} className="text-sm text-ink-soft">
          {t("explorer.searchLabel")}
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-soft" />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("explorer.searchPlaceholder")}
            className="min-h-12 w-full rounded-xl border border-gold/25 bg-abyss/60 pr-3 pl-10 text-base text-ink placeholder:text-ink-soft/70 focus:border-gold focus:outline-none"
          />
        </div>

        {regions.length === 0 ? (
          <p role="status" className="py-2 text-ink-soft">
            {t("explorer.noResult")}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {regions.map((region) => (
              <li key={region.id}>
                <Link
                  href={`/explorer/${region.slug}`}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-gold/15 bg-abyss/30 px-3 py-2 transition-colors hover:border-gold/50 focus-visible:outline-2 focus-visible:outline-gold"
                >
                  <MapPin aria-hidden className="size-5 shrink-0 text-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{tContent(region.nameKey)}</span>
                    <span className="block text-sm text-ink-soft">
                      {hasPlayableTerritory(region.id)
                        ? t("explorer.statusJourney")
                        : t(region.status === "published" ? "explorer.statusPublished" : "explorer.statusDraft")}
                    </span>
                  </span>
                  {status !== "loading" && hasPlayableTerritory(region.id) && !canPlayRegion(region.id) && (
                    <Lock aria-label={t("lock.badge")} className="size-4 shrink-0 text-gold" />
                  )}
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
