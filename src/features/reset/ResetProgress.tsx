"use client";

import { RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import content from "@country";
import { previewReset, type ResetPreview, type ResetScope, resetTargets } from "@/engine/progress-reset";
import { useChallengeRecords, useDailyRecords, useLevelRecords } from "@/features/journey/useLevelRecords";
import { NATIONAL_BADGES } from "@/features/national/national-content";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey, TranslationValues } from "@/i18n/translator";
import { resetProgress } from "@/services/local-progress";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";

const { territories, country } = content;
const playable = territories.filter((territory) => territory.levels.length > 0);

const SELECT_CLASS = "min-h-12 w-full rounded-xl border border-gold/30 bg-abyss px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
const DANGER_BUTTON = "inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-danger-solid px-5 font-semibold text-white transition-colors hover:bg-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:bg-surface-light disabled:text-ink-soft/70";

const usePreview = (scope: ResetScope): ResetPreview => previewReset(scope, territories, useLevelRecords(), useChallengeRecords(), { daily: useDailyRecords(), badges: NATIONAL_BADGES });

/** La suppression n'a lieu qu'ici, après la confirmation explicite du joueur. Le succès n'est annoncé qu'une fois l'écriture faite. */
function useResetAction() {
  const modal = useModal();
  return async (
    scope: ResetScope,
    preview: ResetPreview,
    keys: { titleKey: TranslationKey; bodyKey: TranslationKey; doneTitleKey: TranslationKey; doneBodyKey: TranslationKey },
    names: TranslationValues,
  ): Promise<boolean> => {
    const { levels, stars, score, plays, xp, days, challenges, cards, badges } = preview;
    const values = { levels, stars, score, plays, xp, days, challenges, cards, badges, ...names };
    const confirmed = await modal.destructive({
      titleKey: keys.titleKey,
      bodyKey: keys.bodyKey,
      values,
      confirmKey: "reset.confirm",
      cancelKey: "common.cancel",
    });
    if (!confirmed) return false;
    try {
      resetProgress(country.code, resetTargets(scope, territories));
    } catch (error) {
      await modal.error(error);
      return false;
    }
    await modal.success({ titleKey: keys.doneTitleKey, bodyKey: keys.doneBodyKey, values });
    return true;
  };
}

/** La portée exacte : ce qui serait effacé dans l'état actuel, et ce qui resterait. */
function ScopeDetails({ preview, historyKey, keptKey, values, showLocks = true }: { preview: ResetPreview; historyKey: TranslationKey; keptKey: TranslationKey; values: TranslationValues; showLocks?: boolean }) {
  const { t } = useTranslation();
  if (!preview.hasData) return <p role="status" className="text-sm text-ink-soft">{t("reset.nothing")}</p>;

  const rows: [TranslationKey, number][] = [
    ["reset.details.levels", preview.levels],
    ["reset.details.stars", preview.stars],
    ["reset.details.score", preview.score],
    ["reset.details.plays", preview.plays],
    ["reset.details.xp", preview.xp],
    // Les jours du Défi du jour ne s'effacent qu'avec toute la progression.
    ...(showLocks ? [] : [["reset.details.days", preview.days] as [TranslationKey, number]]),
    ["reset.details.challenges", preview.challenges],
    ["reset.details.cards", preview.cards],
    ["reset.details.badges", preview.badges],
  ];

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="font-semibold">{t("reset.details.title")}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-3 border-b border-gold/10 py-1">
            <dt className="text-ink-soft">{t(key)}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-ink-soft">{t(historyKey, values)}</p>
      {showLocks && preview.relockedLevels > 0 && <p className="text-ink-soft">{t("reset.details.relockedLevels", { count: preview.relockedLevels })}</p>}
      {showLocks && preview.relockedChallenges > 0 && <p className="text-ink-soft">{t("reset.details.relockedChallenges")}</p>}
      <p className="text-ink-soft">{t(keptKey, values)}</p>
    </div>
  );
}

function ScopeCard({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-gold/25 bg-surface/50 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-ink-soft">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function TerritorySelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t, tContent } = useTranslation();
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">{t("reset.territoryLabel")}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>
        {territories.map((territory) => (
          <option key={territory.id} value={territory.id} disabled={territory.levels.length === 0}>
            {territory.levels.length === 0 ? t("reset.territoryPreparing", { territory: tContent(territory.nameKey) }) : tContent(territory.nameKey)}
          </option>
        ))}
      </select>
    </div>
  );
}

function LevelReset() {
  const { t, tContent } = useTranslation();
  const levelFieldId = useId();
  const reset = useResetAction();
  const [territoryId, setTerritoryId] = useState(playable[0]?.id ?? "");
  const [levelId, setLevelId] = useState(playable[0]?.levels[0]?.id ?? "");
  const territory = playable.find((candidate) => candidate.id === territoryId);
  const level = territory?.levels.find((candidate) => candidate.id === levelId) ?? territory?.levels[0];
  const scope: ResetScope = { kind: "level", levelId: level?.id ?? "" };
  const preview = usePreview(scope);
  if (!territory || !level) return null;
  const names = { level: tContent(level.nameKey), territory: tContent(territory.nameKey) };

  return (
    <ScopeCard title={t("reset.level.title")} intro={t("reset.level.intro")}>
      <TerritorySelect value={territory.id} onChange={setTerritoryId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={levelFieldId} className="text-sm font-semibold">{t("reset.levelLabel")}</label>
        <select id={levelFieldId} value={level.id} onChange={(event) => setLevelId(event.target.value)} className={SELECT_CLASS}>
          {territory.levels.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{tContent(candidate.nameKey)}</option>
          ))}
        </select>
      </div>
      <ScopeDetails preview={preview} historyKey="reset.level.history" keptKey="reset.level.kept" values={names} />
      <button
        type="button"
        disabled={!preview.hasData}
        onClick={() => void reset(scope, preview, {
          titleKey: "reset.level.confirmTitle",
          bodyKey: "reset.level.confirmBody",
          doneTitleKey: "reset.level.doneTitle",
          doneBodyKey: "reset.level.doneBody",
        }, names)}
        className={DANGER_BUTTON}
      >
        <RotateCcw aria-hidden className="size-5" />
        {t("reset.level.action")}
      </button>
    </ScopeCard>
  );
}

function TerritoryReset() {
  const { t, tContent } = useTranslation();
  const reset = useResetAction();
  const [territoryId, setTerritoryId] = useState(playable[0]?.id ?? "");
  const territory = playable.find((candidate) => candidate.id === territoryId);
  const scope: ResetScope = { kind: "territory", territoryId };
  const preview = usePreview(scope);
  if (!territory) return null;
  const names = { territory: tContent(territory.nameKey), total: territory.levels.length };

  return (
    <ScopeCard title={t("reset.territory.title")} intro={t("reset.territory.intro")}>
      <TerritorySelect value={territory.id} onChange={setTerritoryId} />
      <ScopeDetails preview={preview} historyKey="reset.territory.history" keptKey="reset.territory.kept" values={names} />
      <button
        type="button"
        disabled={!preview.hasData}
        onClick={() => void reset(scope, preview, {
          titleKey: "reset.territory.confirmTitle",
          bodyKey: "reset.territory.confirmBody",
          doneTitleKey: "reset.territory.doneTitle",
          doneBodyKey: "reset.territory.doneBody",
        }, names)}
        className={DANGER_BUTTON}
      >
        <RotateCcw aria-hidden className="size-5" />
        {t("reset.territory.action")}
      </button>
    </ScopeCard>
  );
}

const COUNTRY_SCOPE: ResetScope = { kind: "country" };

/** Confirmation renforcée : une case à cocher sur la page, en plus de la modale. */
function CountryReset() {
  const { t } = useTranslation();
  const reset = useResetAction();
  const [understood, setUnderstood] = useState(false);
  const preview = usePreview(COUNTRY_SCOPE);
  const names = { app: country.appName };

  const run = async () => {
    const done = await reset(COUNTRY_SCOPE, preview, {
      titleKey: "reset.country.confirmTitle",
      bodyKey: "reset.country.confirmBody",
      doneTitleKey: "reset.country.doneTitle",
      doneBodyKey: "reset.country.doneBody",
    }, names);
    if (done) setUnderstood(false);
  };

  return (
    <ScopeCard title={t("reset.country.title", names)} intro={t("reset.country.intro", names)}>
      <ScopeDetails preview={preview} historyKey="reset.country.history" keptKey="reset.country.kept" values={names} showLocks={false} />
      {preview.hasData && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-danger/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-gold)]"
          />
          <span>{t("reset.country.understand", names)}</span>
        </label>
      )}
      <button type="button" disabled={!preview.hasData || !understood} onClick={() => void run()} className={DANGER_BUTTON}>
        <RotateCcw aria-hidden className="size-5" />
        {t("reset.country.action", names)}
      </button>
    </ScopeCard>
  );
}

export function ResetProgress() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-3 rounded-3xl border border-gold/25 bg-surface/60 p-5">
        <span className="flex size-12 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
          <RotateCcw aria-hidden className="size-6 text-gold" />
        </span>
        <h1 className="font-display text-3xl font-semibold">{t("reset.title")}</h1>
        <p className="text-ink-soft">{t("reset.intro")}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-gold/15 bg-abyss/30 p-5 text-sm">
        <p className="flex items-start gap-3">
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-gold" />
          <span>{t("reset.profileLimit", { app: country.appName })}</span>
        </p>
        <p className="flex items-start gap-3">
          <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-gold" />
          <span>{t("reset.xpRule")}</span>
        </p>
      </section>

      <LevelReset />
      <TerritoryReset />
      <CountryReset />

      <BackLink href="/profil/confidentialite" label={t("privacy.backToHub")} />
    </main>
  );
}
