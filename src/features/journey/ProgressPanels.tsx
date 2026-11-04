"use client";

import { summarizeCountry, summarizeProgress, type ProgressLevel, type ProgressTerritory } from "@/engine/progress-summary";
import { useTranslation } from "@/i18n/I18nProvider";
import { useLevelRecords } from "./useLevelRecords";

function Stat({ label, value, className = "" }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border border-gold/15 bg-abyss/30 p-3 ${className}`}>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="font-display text-xl font-semibold text-gold">{value}</dd>
    </div>
  );
}

/** Cumuls d'un parcours, recalculés depuis les résultats enregistrés sur cet appareil. */
export function TerritoryProgress({ levels }: { levels: readonly ProgressLevel[] }) {
  const { t } = useTranslation();
  const progress = summarizeProgress(levels, useLevelRecords());
  const percent = progress.starsMax === 0 ? 0 : Math.round((progress.stars / progress.starsMax) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
      <h3 className="font-display text-lg font-semibold">{t("journey.progress.title")}</h3>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label={t("journey.progress.levels")} value={t("journey.progress.ofTotal", { value: progress.levelsFinished, total: progress.levelsTotal })} />
        <Stat label={t("journey.progress.stars")} value={t("journey.progress.ofTotal", { value: progress.stars, total: progress.starsMax })} />
        <Stat
          className="col-span-2 sm:col-span-1"
          label={t("journey.progress.score")}
          value={t("journey.progress.ofTotal", { value: progress.bestScoreTotal, total: progress.bestScoreMax })}
        />
        <Stat className="col-span-2 sm:col-span-1" label={t("journey.progress.xp")} value={progress.xp} />
      </dl>
      <div
        role="progressbar"
        aria-label={t("journey.progress.stars")}
        aria-valuemin={0}
        aria-valuemax={progress.starsMax}
        aria-valuenow={progress.stars}
        className="h-1.5 overflow-hidden rounded-full bg-abyss/60"
      >
        <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Cumuls de tout le pays, à zéro tant qu'aucune partie n'a été jouée sur cet appareil. */
export function NationalProgress({ territories }: { territories: readonly ProgressTerritory[] }) {
  const { t, tContent } = useTranslation();
  const progress = summarizeCountry(territories, useLevelRecords());

  return (
    <section className="flex w-full flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5 text-left">
      <h2 className="font-display text-xl font-semibold">{tContent("country.progressTitle")}</h2>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label={t("journey.progress.levels")} value={progress.levelsFinished} />
        <Stat label={t("journey.progress.stars")} value={progress.stars} />
        <Stat label={t("journey.progress.score")} value={progress.bestScoreTotal} />
        <Stat label={t("journey.progress.xp")} value={progress.xp} />
        <Stat className="col-span-2" label={t("journey.progress.territories")} value={progress.territoriesExplored} />
      </dl>
      <p className="text-sm text-ink-soft">{t("journey.deviceOnly")}</p>
    </section>
  );
}
