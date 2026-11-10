"use client";

import { ArrowRight, Flag, History, Play, RotateCcw, Sparkles, Trophy, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import content from "@country";
import {
  advanceTurn,
  answerTurn,
  beginTurn,
  createFamilyGame,
  currentPlayer,
  FAMILY_RULES,
  type FamilyGame,
  type FamilyScope,
  familyGameSize,
  familyPool,
  familyStandings,
  familyWinners,
  isGameResumable,
  isLastQuestionOfTurn,
  jokerTurn,
  nextRound,
  planFamilyGame,
  scopeKey,
  totalRounds,
  turnPoints,
} from "@/engine/family";
import type { RunBank } from "@/engine/level-run";
import { ChallengeView } from "@/features/journey/ChallengeView";
import { usePromotion } from "@/features/promotions/usePromotion";
import { useHoldUpdate } from "@/features/update/update-hold";
import { CheckingAccess, LockCard } from "@/features/account/RegionGate";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import { readFamilyData, recordFamilyGame, saveFamilyGame } from "@/services/family-storage";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { useLeaveGuard } from "@/ui/nav/leave-guard";
import { FamilySetup, type FamilySettings } from "./FamilySetup";
import { card, FamilyStandings, PlayerBadge, primaryButton, secondaryButton, useFamilyData, useNameList, useScopeName } from "./family-ui";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// Une réserve par choix de questions, calculée une fois : le contenu ne change pas pendant la visite.
const banks = new Map<string, RunBank>();
function bankOf(scope: FamilyScope): RunBank {
  const key = scopeKey(scope);
  const bank = banks.get(key) ?? familyPool(content.territories, scope, content.family.themes);
  banks.set(key, bank);
  return bank;
}

const pointsOf = (game: FamilyGame, playerId: string) =>
  game.turns.filter((turn) => turn.playerId === playerId).reduce((sum, turn) => sum + turn.points, 0);

/** Mode Famille : réglages, passage de l'appareil, tours, classements, fin de partie. Aucun territoire n'est codé ici. */
export function FamilyMode() {
  const { t, locale } = useTranslation();
  const modal = useModal();
  const nameList = useNameList();
  const scopeName = useScopeName();
  const data = useFamilyData();
  const access = useEntitlements();
  const [game, setGame] = useState<FamilyGame | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const storageWarned = useRef(false);
  const bank = game ? bankOf(game.scope) : null;
  useHoldUpdate(game !== null && game.phase !== "finished");
  // La partie est déjà gardée à chaque étape (saveFamilyGame) : la navigation demande seulement confirmation.
  useLeaveGuard(game !== null && game.phase !== "finished", { bodyKey: "journey.leave.bodyFamily", backHref: "/" });
  // Jamais entre deux tours : la promotion n'apparaît que sur l'écran final ou l'accueil du mode.
  const promotion = usePromotion(game !== null && game.phase !== "finished");

  // Chaque écran entre deux joueurs repart du haut : rien de la question précédente ne reste à l'écran.
  const screen = game ? `${game.phase}-${game.turns.length}` : "setup";
  const isPlaying = game?.phase === "playing";
  useEffect(() => {
    // L'écran de question gère lui-même le défilement et le focus.
    if (isPlaying) return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [screen, isPlaying]);

  // Mode Famille réservé aux éditions Famille : droit calculé par le serveur, jamais par le navigateur.
  if (!access.entitlements.familyAccess) {
    if (access.status === "loading") return <CheckingAccess />;
    return <LockCard title={t("lock.familyTitle")} body={t("lock.familyBody")} cta={t("lock.familyCta")} href="/boutique?edition=family_ads" back="/" />;
  }

  const resumable = !game && data.current && isGameResumable(data.current, bankOf(data.current.scope)) ? data.current : null;

  /** La partie avance même si l'appareil refuse d'écrire : seul le joueur est prévenu, une fois. */
  const persist = (write: () => void) => {
    try {
      write();
    } catch (error) {
      if (!storageWarned.current) void modal.error(error);
      storageWarned.current = true;
    }
  };

  const update = (next: FamilyGame) => {
    setGame(next);
    if (next.phase === "finished") {
      persist(() => recordFamilyGame(content.country.code, next));
      promotion.gameCompleted();
    } else persist(() => saveFamilyGame(content.country.code, next));
  };

  const start = ({ players, duration, scope }: FamilySettings) => {
    const avoid = new Set(readFamilyData(content.country.code).recent.flat());
    const plan = planFamilyGame(bankOf(scope), familyGameSize(duration, players.length), Math.random, avoid);
    if (!plan) {
      void modal.info({ titleKey: "family.tooSmallTitle", bodyKey: "family.tooSmallBody" });
      return;
    }
    update(createFamilyGame({ id: newId(), scope, duration, players, plan, startedAt: new Date().toISOString() }));
  };

  const replay = (finished: FamilyGame) =>
    start({ players: finished.players.map(({ id, name, color }) => ({ id, name, color })), duration: finished.duration, scope: finished.scope });

  const abandon = async () => {
    const confirmed = await modal.destructive({ titleKey: "family.quitTitle", bodyKey: "family.quitBody", confirmKey: "family.quit" });
    if (!confirmed) return;
    persist(() => saveFamilyGame(content.country.code, null));
    setGame(null);
  };

  const quitButton = (
    <button type="button" onClick={() => void abandon()} className="inline-flex min-h-11 items-center gap-1 self-center rounded-xl px-3 text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-gold">
      <Flag aria-hidden className="size-4" />
      {t("family.quit")}
    </button>
  );

  const heading = (text: string, small = false) => (
    <h1 ref={headingRef} tabIndex={-1} className={`font-display font-semibold outline-none ${small ? "text-2xl" : "text-3xl"}`}>
      {text}
    </h1>
  );

  if (!game || !bank) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        {promotion.overlay}
        <section className="fade-in flex flex-col gap-2">
          {heading(t("family.title"))}
          <p className="text-ink-soft">{t("family.intro")}</p>
        </section>

        {resumable && (
          <section className={`${card} border-gold/60`}>
            <h2 className="font-display text-xl font-semibold">{t("family.resume.title")}</h2>
            <p className="text-ink-soft">
              {t("family.resume.body", {
                players: nameList(resumable.players.map((player) => player.name)),
                round: resumable.round + 1,
                total: totalRounds(resumable),
              })}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setGame(resumable)} className={primaryButton}>
                <Play aria-hidden className="size-5" />
                {t("family.resume.continue")}
              </button>
              <button type="button" onClick={() => void abandon()} className={secondaryButton}>
                {t("family.resume.abandon")}
              </button>
            </div>
          </section>
        )}

        <FamilySetup onStart={start} />
        <FamilyHistory scopeName={scopeName} />
        <BackLink href="/" label={t("common.backHome")} />
      </main>
    );
  }

  const total = totalRounds(game);

  if (game.phase === "handoff") {
    const player = currentPlayer(game);
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        <section className={`${card} items-center text-center`}>
          <p className="font-semibold text-gold">{t("family.handoff.round", { current: game.round + 1, total })}</p>
          <PlayerBadge player={player} size="lg" />
          {heading(t("family.handoff.title", { name: player.name }))}
          <p className="text-ink-soft">
            {t("family.handoff.body", { name: player.name, count: FAMILY_RULES.questionsPerTurn[game.duration] })}
          </p>
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
            <span>{t("family.handoff.points", { count: pointsOf(game, player.id) })}</span>
            <span className="inline-flex items-center gap-1 text-ink-soft">
              <WandSparkles aria-hidden className="size-4 text-gold" />
              {t("family.handoff.jokers", { count: player.jokersLeft })}
            </span>
          </p>
          <button type="button" onClick={() => update(beginTurn(game, bank, Math.random))} className={`${primaryButton} w-full sm:w-auto`}>
            {t("family.handoff.ready")}
            <ArrowRight aria-hidden className="size-5" />
          </button>
        </section>
        {quitButton}
      </main>
    );
  }

  if (game.phase === "playing" && game.run) {
    const player = currentPlayer(game);
    const lastOfRound = game.turn === game.players.length - 1;
    const next = !isLastQuestionOfTurn(game)
      ? t("family.game.nextQuestion")
      : !lastOfRound
        ? t("family.game.endTurn")
        : game.round < total - 1
          ? t("family.game.seeRound")
          : t("family.game.seeFinal");
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <PlayerBadge player={player} size="sm" />
          {t("family.title")}
        </p>
        <ChallengeView
          key={game.turns.length}
          level={bank}
          run={game.run}
          onAnswer={(answerId) => update(answerTurn(game, bank, answerId))}
          onJoker={() => update(jokerTurn(game, bank, Math.random))}
          onNext={() => update(advanceTurn(game, bank, Math.random, new Date().toISOString()))}
          onQuit={() => void abandon()}
          labels={{
            progress: t("family.game.progress", {
              current: game.round + 1,
              total,
              name: player.name,
              question: game.run.index + 1,
              questions: game.run.challengeIds.length,
            }),
            score: t("family.handoff.points", { count: pointsOf(game, player.id) + turnPoints(game) }),
            jokerNote: t("family.game.jokerNote", { points: FAMILY_RULES.points.joker }),
            next,
          }}
        />
      </main>
    );
  }

  const standings = familyStandings(game);

  if (game.phase === "summary") {
    const roundPoints = Object.fromEntries(
      game.players.map((player) => [
        player.id,
        game.turns.filter((turn) => turn.round === game.round && turn.playerId === player.id).reduce((sum, turn) => sum + turn.points, 0),
      ]),
    );
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        <section className={card}>
          {heading(t("family.summary.title", { current: game.round + 1, total }), true)}
          <FamilyStandings standings={standings} roundPoints={roundPoints} />
          <button type="button" onClick={() => update(nextRound(game))} className={primaryButton}>
            {t("family.summary.next")}
            <ArrowRight aria-hidden className="size-5" />
          </button>
        </section>
        {quitButton}
      </main>
    );
  }

  const winners = familyWinners(standings);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      {promotion.overlay}
      <section className={`${card} items-center text-center`}>
        <div className="family-victory relative flex size-28 items-center justify-center">
          <span aria-hidden className="family-victory-glow absolute inset-0 rounded-full bg-gold/20" />
          <Sparkles aria-hidden className="family-spark absolute -top-1 left-2 size-5 text-gold-light" />
          <Sparkles aria-hidden className="family-spark family-spark-late absolute top-3 -right-1 size-4 text-gold" />
          <Sparkles aria-hidden className="family-spark family-spark-later absolute bottom-1 -left-2 size-4 text-gold-light" />
          <Trophy aria-hidden className="relative size-16 text-gold" />
        </div>
        <p className="font-semibold text-gold">{t("family.final.title")}</p>
        {heading(
          winners.length === 1
            ? t("family.final.winner", { name: winners[0]!.player.name })
            : t("family.final.winners", { names: nameList(winners.map((row) => row.player.name)) }),
        )}
        <div className="flex -space-x-2">
          {winners.map((row) => (
            <PlayerBadge key={row.player.id} player={row.player} />
          ))}
        </div>
        <p className="text-sm text-ink-soft">
          {t("family.history.entry", { scope: scopeName(game.scope), duration: t(`family.durationsLower.${game.duration}`) })}
          {game.finishedAt && `, ${dateFormat.format(new Date(game.finishedAt))}`}
        </p>
      </section>

      <section className={card}>
        <h2 className="font-display text-xl font-semibold">{t("family.standings.title")}</h2>
        <FamilyStandings standings={standings} detailed />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => replay(game)} className={primaryButton}>
            <RotateCcw aria-hidden className="size-5" />
            {t("family.final.replay")}
          </button>
          <Link href="/" className={secondaryButton}>
            {t("common.backHome")}
          </Link>
        </div>
        <p className="text-sm text-ink-soft">{t("family.separate")}</p>
      </section>
    </main>
  );
}

/** Dernières parties terminées sur cet appareil. */
function FamilyHistory({ scopeName }: { scopeName: (scope: FamilyScope) => string }) {
  const { t, locale } = useTranslation();
  const nameList = useNameList();
  const { history } = useFamilyData();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <History aria-hidden className="size-5 text-gold" />
        {t("family.history.title")}
      </h2>
      {history.length === 0 ? (
        <p className="text-ink-soft">{t("family.history.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {history.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 rounded-2xl border border-gold/15 bg-abyss/30 p-3">
              <span className="text-sm text-ink-soft">{dateFormat.format(new Date(entry.finishedAt))}</span>
              <span className="font-semibold">
                {t("family.history.entry", { scope: scopeName(entry.scope), duration: t(`family.durationsLower.${entry.duration}`) })}
              </span>
              <span className="text-sm text-gold">
                {t("family.history.leader", { names: nameList(entry.standings.filter((row) => row.rank === 1).map((row) => row.name)) })}
              </span>
              <span className="text-sm text-ink-soft">
                {entry.standings.map((row) => `${row.name} ${t("family.standings.points", { count: row.points })}`).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
