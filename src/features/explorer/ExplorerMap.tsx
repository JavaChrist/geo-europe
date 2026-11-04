"use client";

import { useState } from "react";
import content from "@country";
import { useTranslation } from "@/i18n/I18nProvider";
import { CountryMap } from "@/ui/map/CountryMap";

/** Carte interactive, avec le nom de la région survolée ou ciblée au clavier. */
export function ExplorerMap() {
  const { t, tContent } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = content.regions.find((region) => region.id === activeId);

  return (
    <div className="flex flex-col gap-2">
      <p aria-hidden className="min-h-7 text-center font-semibold text-gold">
        {active ? tContent(active.nameKey) : t("explorer.mapHint")}
      </p>
      <CountryMap nameOf={tContent} label={t("explorer.mapLabel")} interactive onActiveChange={setActiveId} />
    </div>
  );
}
