"use client";

import { Check, Play, Plus, X } from "lucide-react";
import { type FormEvent, useId, useMemo, useState } from "react";
import content from "@country";
import {
  FAMILY_COLORS,
  FAMILY_DURATIONS,
  FAMILY_RULES,
  type FamilyDuration,
  type FamilyPlayer,
  type FamilyScope,
  familyPool,
  playableDurations,
  scopeKey,
} from "@/engine/family";
import { useTranslation } from "@/i18n/I18nProvider";
import { removeFamilyPlayer, saveFamilyPlayers } from "@/services/family-storage";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, PlayerBadge, primaryButton, useFamilyData, useNameList } from "./family-ui";

export interface FamilySettings {
  players: FamilyPlayer[];
  duration: FamilyDuration;
  scope: FamilyScope;
}

// Vérifier qu'un choix suffit ne demande pas de vrai hasard : le tirage de la partie, lui, en utilise.
const PREVIEW_RANDOM = () => 0.5;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const published = content.territories.filter((territory) => territory.status === "published");

const SCOPES: FamilyScope[] = [
  { kind: "country" },
  ...content.family.themes.map((theme): FamilyScope => ({ kind: "theme", themeId: theme.id })),
  ...published.map((territory): FamilyScope => ({ kind: "territory", territoryId: territory.id })),
];

const chip = "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export function FamilySetup({ onStart }: { onStart: (settings: FamilySettings) => void }) {
  const { t, tContent } = useTranslation();
  const modal = useModal();
  const nameList = useNameList();
  const { players: saved } = useFamilyData();
  const nameId = useId();
  const errorId = useId();
  const scopeId = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [duration, setDuration] = useState<FamilyDuration>(FAMILY_RULES.defaultDuration);
  const [scopeValue, setScopeValue] = useState(scopeKey({ kind: "country" }));

  // Un joueur retiré de la liste quitte aussi la sélection.
  const chosen = selected.filter((id) => saved.some((player) => player.id === id));
  const scope = SCOPES.find((candidate) => scopeKey(candidate) === scopeValue) ?? SCOPES[0]!;
  const bank = useMemo(() => familyPool(content.territories, scope, content.family.themes), [scope]);
  const count = Math.max(chosen.length, FAMILY_RULES.minPlayers);
  const playable = useMemo(() => playableDurations(bank, count, PREVIEW_RANDOM), [bank, count]);
  const enoughPlayers = chosen.length >= FAMILY_RULES.minPlayers;
  const full = chosen.length >= FAMILY_RULES.maxPlayers;

  const toggle = (id: string) =>
    setSelected((current) => {
      const kept = current.filter((candidate) => saved.some((player) => player.id === candidate));
      if (kept.includes(id)) return kept.filter((candidate) => candidate !== id);
      return kept.length < FAMILY_RULES.maxPlayers ? [...kept, id] : kept;
    });

  const add = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) return setNameError(t("family.setup.nameEmpty"));
    if (saved.some((player) => player.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      return setNameError(t("family.setup.nameTaken"));
    }
    const taken = new Set(saved.map((player) => player.color));
    const color = FAMILY_COLORS.find((candidate) => !taken.has(candidate)) ?? FAMILY_COLORS[saved.length % FAMILY_COLORS.length]!;
    const player: FamilyPlayer = { id: newId(), name: trimmed.slice(0, FAMILY_RULES.maxNameLength), color };
    try {
      saveFamilyPlayers(content.country.code, [player]);
    } catch (error) {
      void modal.error(error);
      return;
    }
    setName("");
    setNameError(null);
    if (!full) setSelected([...chosen, player.id]);
  };

  const remove = async (player: FamilyPlayer) => {
    const confirmed = await modal.destructive({
      titleKey: "family.setup.removeTitle",
      bodyKey: "family.setup.removeBody",
      confirmKey: "family.setup.remove",
      values: { name: player.name },
    });
    if (!confirmed) return;
    try {
      removeFamilyPlayer(content.country.code, player.id);
    } catch (error) {
      void modal.error(error);
    }
  };

  const start = () => {
    const players = chosen.map((id) => saved.find((player) => player.id === id)).filter((player) => player !== undefined);
    onStart({ players, duration, scope });
  };

  const canStart = enoughPlayers && playable.includes(duration);

  return (
    <>
      <section className={card} aria-labelledby={`${nameId}-players`}>
        <div className="flex flex-col gap-1">
          <h2 id={`${nameId}-players`} className="font-display text-xl font-semibold">
            {t("family.setup.playersTitle")}
          </h2>
          <p className="text-sm text-ink-soft">
            {t("family.setup.playersHint", { min: FAMILY_RULES.minPlayers, max: FAMILY_RULES.maxPlayers })}
          </p>
        </div>

        {saved.length === 0 ? (
          <p className="text-ink-soft">{t("family.setup.noPlayers")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {saved.map((player) => {
              const position = chosen.indexOf(player.id);
              const isChosen = position >= 0;
              return (
                <li key={player.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    aria-pressed={isChosen}
                    disabled={!isChosen && full}
                    onClick={() => toggle(player.id)}
                    className={`${chip} min-w-0 flex-1 ${isChosen ? "border-gold bg-gold/15" : "border-gold/25 bg-abyss/30 hover:border-gold/60"} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <PlayerBadge player={player} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-left">{player.name}</span>
                    {isChosen && (
                      <span className="flex items-center gap-1 text-sm text-gold">
                        <Check aria-hidden className="size-4" />
                        {position + 1}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(player)}
                    aria-label={t("family.setup.removePlayer", { name: player.name })}
                    className="inline-flex min-h-12 min-w-11 items-center justify-center rounded-xl text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
                  >
                    <X aria-hidden className="size-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-sm text-gold" aria-live="polite">
          {t("family.setup.selected", { count: chosen.length })}
          {chosen.length > 0 && ` : ${nameList(chosen.map((id) => saved.find((player) => player.id === id)?.name ?? ""))}`}
          {full && ` ${t("family.setup.maxReached", { count: FAMILY_RULES.maxPlayers })}`}
        </p>

        <form onSubmit={add} noValidate className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm font-semibold">
            {t("family.setup.nameLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id={nameId}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
              maxLength={FAMILY_RULES.maxNameLength}
              autoComplete="off"
              placeholder={t("family.setup.namePlaceholder")}
              aria-invalid={nameError !== null}
              aria-describedby={nameError ? errorId : undefined}
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-gold/30 bg-abyss/40 px-3 text-ink placeholder:text-ink-soft/70 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-gold"
            />
            <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/40 px-4 font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
              <Plus aria-hidden className="size-5" />
              {t("family.setup.add")}
            </button>
          </div>
          {nameError && (
            <p id={errorId} className="text-sm text-danger">
              {nameError}
            </p>
          )}
        </form>
      </section>

      <section className={card} aria-labelledby={`${nameId}-duration`}>
        <h2 id={`${nameId}-duration`} className="font-display text-xl font-semibold">
          {t("family.setup.durationTitle")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {FAMILY_DURATIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={duration === option}
              onClick={() => setDuration(option)}
              className={`${chip} flex-col justify-center gap-0 text-center ${duration === option ? "border-gold bg-gold/15" : "border-gold/25 bg-abyss/30 hover:border-gold/60"}`}
            >
              <span>{t(`family.durations.${option}`)}</span>
              <span className="text-sm font-normal text-ink-soft">{t("family.setup.rounds", { count: FAMILY_RULES.rounds[option] })}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <label htmlFor={scopeId} className="font-display text-xl font-semibold">
          {t("family.setup.scopeTitle")}
        </label>
        <select
          id={scopeId}
          value={scopeValue}
          onChange={(event) => setScopeValue(event.target.value)}
          className="min-h-12 rounded-xl border border-gold/30 bg-abyss px-3 text-ink focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-gold"
        >
          <option value={scopeKey({ kind: "country" })}>
            {t("family.setup.scopeOption", {
              name: tContent("familyScopes.wholeCountry"),
              note: tContent("familyScopes.wholeCountryNote", { count: published.length }),
            })}
          </option>
          <optgroup label={t("family.setup.groupThemes")}>
            {content.family.themes.map((theme) => (
              <option key={theme.id} value={scopeKey({ kind: "theme", themeId: theme.id })}>
                {tContent(theme.nameKey)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("family.setup.groupTerritories")}>
            {published.map((territory) => (
              <option key={territory.id} value={scopeKey({ kind: "territory", territoryId: territory.id })}>
                {tContent(territory.nameKey)}
              </option>
            ))}
          </optgroup>
        </select>
        <p className="text-sm text-ink-soft">{t("family.setup.poolSize", { count: bank.questions.length })}</p>

        {!playable.includes(duration) && (
          <div role="status" className="rounded-2xl border border-sky/40 bg-abyss/40 p-4 text-sm">
            {playable.length === 0 ? (
              <p>{t("family.setup.tooSmallNone", { count })}</p>
            ) : (
              <>
                <p>{t("family.setup.tooSmall", { duration: t(`family.durationsLower.${duration}`), count })}</p>
                <p className="mt-1 text-ink-soft">
                  {t("family.setup.tooSmallAlternative", {
                    durations: nameList(playable.map((option) => t(`family.durationsLower.${option}`))),
                  })}
                </p>
              </>
            )}
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="font-display text-xl font-semibold">{t("family.setup.rulesTitle")}</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-soft">
          <li>{t("family.rules.rounds")}</li>
          <li>{t("family.rules.difficulty")}</li>
          <li>{t("family.rules.points", FAMILY_RULES.points)}</li>
          <li>{t("family.rules.jokers", { count: FAMILY_RULES.jokers[duration] })}</li>
          <li>{t("family.rules.noTimer")}</li>
          <li>{t("family.separate")}</li>
        </ul>
        {!enoughPlayers && <p className="text-sm text-gold">{t("family.setup.needPlayers", { count: FAMILY_RULES.minPlayers })}</p>}
        <button type="button" disabled={!canStart} onClick={start} className={primaryButton}>
          <Play aria-hidden className="size-5" />
          {t("family.setup.start")}
        </button>
      </section>
    </>
  );
}
