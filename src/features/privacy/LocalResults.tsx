"use client";

import { Trash2 } from "lucide-react";
import content from "@country";
import { maxScoreOf, starsFor } from "@/engine/level-run";
import { earnedXp } from "@/engine/progress-summary";
import { useLevelRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import { clearLevelRecords } from "@/services/local-progress";
import { useModal } from "@/ui/modal/ModalProvider";

const levels = content.territories.flatMap((territory) => territory.levels);

/** Ce que le jeu a réellement enregistré sur cet appareil, niveau par niveau. */
export function LocalResultsList() {
  const { locale, t, tContent } = useTranslation();
  const records = useLevelRecords();
  const played = levels.flatMap((level) => {
    const record = records[level.id];
    return record ? [{ level, record }] : [];
  });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
      <h2 className="font-display text-xl font-semibold">{t("privacy.localResults.title")}</h2>
      {played.length === 0 ? (
        <p role="status" className="text-ink-soft">{t("privacy.localResults.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {played.map(({ level, record }) => (
            <li key={level.id} className="flex flex-col gap-1 rounded-2xl border border-gold/15 bg-abyss/30 p-4 text-sm">
              <span className="font-semibold">{tContent(level.nameKey)}</span>
              <span className="text-ink-soft">{t("journey.bestScore", { score: record.bestScore, max: maxScoreOf(level) })}</span>
              <span className="text-ink-soft">{t("privacy.localResults.lastScore", { score: record.lastScore, max: maxScoreOf(level) })}</span>
              <span className="text-ink-soft">{t("journey.stars", { count: starsFor(record.bestScore, level.stars) })}</span>
              <span className="text-ink-soft">{t("privacy.localResults.xp", { count: earnedXp(record) })}</span>
              <span className="text-ink-soft">{t("journey.plays", { count: record.plays })}</span>
              <span className="text-ink-soft">
                {t("privacy.localResults.lastPlayed", { date: dateFormat.format(new Date(record.lastPlayedAt)) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Efface les résultats de cet appareil, après confirmation. */
export function LocalResultsDelete() {
  const { t } = useTranslation();
  const modal = useModal();
  const hasResults = Object.keys(useLevelRecords()).length > 0;

  const erase = async () => {
    const confirmed = await modal.destructive({
      titleKey: "privacy.localResults.deleteTitle",
      bodyKey: "privacy.localResults.deleteBody",
      confirmKey: "common.delete",
    });
    if (!confirmed) return;
    try {
      clearLevelRecords(content.country.code);
      await modal.success({ titleKey: "privacy.localResults.deletedTitle", bodyKey: "privacy.localResults.deletedBody" });
    } catch (error) {
      await modal.error(error);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/50 p-5">
      <h2 className="font-display text-xl font-semibold">{t("privacy.localResults.deleteAction")}</h2>
      <p className="text-ink-soft">
        {t(hasResults ? "privacy.localResults.deleteIntro" : "privacy.localResults.empty")}
      </p>
      <button
        type="button"
        disabled={!hasResults}
        onClick={() => void erase()}
        className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-danger-solid px-5 font-semibold text-white transition-colors hover:bg-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:bg-surface-light disabled:text-ink-soft/70"
      >
        <Trash2 aria-hidden className="size-5" />
        {t("privacy.localResults.deleteAction")}
      </button>
    </section>
  );
}
