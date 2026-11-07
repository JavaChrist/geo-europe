"use client";

import { Trash2 } from "lucide-react";
import content from "@country";
import { maxScoreOf, starsFor } from "@/engine/level-run";
import { earnedXp } from "@/engine/progress-summary";
import { availableSpecialChallenges, challengeKey } from "@/engine/special-challenges";
import { useFamilyData } from "@/features/family/family-ui";
import { formatChallengeTime } from "@/features/journey/challenge-time";
import { useChallengeRecords, useLevelRecords } from "@/features/journey/useLevelRecords";
import { useTranslation } from "@/i18n/I18nProvider";
import { clearFamilyData } from "@/services/family-storage";
import { clearLevelRecords } from "@/services/local-progress";
import { useModal } from "@/ui/modal/ModalProvider";

const levels = content.territories.flatMap((territory) => territory.levels);
const specials = content.territories.flatMap((territory) => availableSpecialChallenges(territory).map((rules) => ({ territory, rules })));

/** Ce que le jeu a réellement enregistré sur cet appareil, niveau par niveau. */
export function LocalResultsList() {
  const { locale, t, tContent } = useTranslation();
  const records = useLevelRecords();
  const played = levels.flatMap((level) => {
    const record = records[level.id];
    return record ? [{ level, record }] : [];
  });
  const challenges = useChallengeRecords();
  const playedSpecials = specials.flatMap(({ territory, rules }) => {
    const record = challenges[challengeKey(territory.id, rules.kind)];
    return record ? [{ territory, rules, record }] : [];
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
          {playedSpecials.map(({ territory, rules, record }) => (
            <li key={`${territory.id}:${rules.kind}`} className="flex flex-col gap-1 rounded-2xl border border-gold/15 bg-abyss/30 p-4 text-sm">
              <span className="font-semibold">
                {t("privacy.localResults.challengeName", { challenge: t(`journey.specials.${rules.kind}.name`), territory: tContent(territory.nameKey) })}
              </span>
              <span className="text-ink-soft">
                {record.bestTimeMs === null
                  ? t("journey.specials.best", { count: record.bestCorrect, total: rules.questions })
                  : t("journey.specials.bestTimed", { count: record.bestCorrect, total: rules.questions, time: formatChallengeTime(t, record.bestTimeMs) })}
              </span>
              <span className="text-ink-soft">{t("privacy.localResults.lastCorrect", { count: record.lastCorrect, total: rules.questions })}</span>
              {record.passed && <span className="text-ink-soft">{t("journey.specials.passed")}</span>}
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
  const family = useFamilyData();
  const hasResults = Object.keys(useLevelRecords()).length > 0 || family.players.length > 0 || family.history.length > 0 || family.current !== null;

  const erase = async () => {
    const confirmed = await modal.destructive({
      titleKey: "privacy.localResults.deleteTitle",
      bodyKey: "privacy.localResults.deleteBody",
      confirmKey: "common.delete",
    });
    if (!confirmed) return;
    try {
      clearLevelRecords(content.country.code);
      clearFamilyData(content.country.code);
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
