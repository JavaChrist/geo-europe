"use client";

import { Check, FileX2, RefreshCw, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import content from "@country";
import type { WithdrawalDecision, WithdrawalRecord, WithdrawalStatus } from "@/engine/withdrawal";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translator";
import { decideWithdrawalRequest, listWithdrawalRequests } from "@/services/account";
import { AppError } from "@/services/app-error";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, input, secondaryButton } from "@/ui/styles";

const appName = content.country.appName;
const PAGE = "/admin/retractations";
const SEPARATOR = " · ";
const statusStyle: Record<WithdrawalStatus, string> = {
  received: "border-sky/50 text-sky",
  accepted: "border-success/50 text-success",
  refused: "border-ink-soft/40 text-ink-soft",
};

type Loaded = { uid: string; result: "forbidden" | WithdrawalRecord[] };

/**
 * Administration des rétractations. Le serveur vérifie l'administrateur à chaque appel. Une décision ne fait que
 * marquer la demande : le remboursement se fait à la main chez Mollie ou dans la Play Console.
 */
export function WithdrawalAdmin() {
  const { t, locale } = useTranslation();
  const modal = useModal();
  const { account, status } = useEntitlements();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "";

  const uid = account?.uid;
  const fetchList = useCallback(
    (forUid: string): Promise<Loaded> =>
      listWithdrawalRequests().then(
        (withdrawals) => ({ uid: forUid, result: withdrawals }),
        async (error: unknown) => {
          if (error instanceof AppError && error.code === "forbidden") return { uid: forUid, result: "forbidden" as const };
          await modal.error(error);
          return { uid: forUid, result: [] };
        },
      ),
    [modal],
  );
  const load = useCallback(async () => {
    if (uid) setLoaded(await fetchList(uid));
  }, [uid, fetchList]);

  useEffect(() => {
    if (status === "loading" || !uid) return;
    fetchList(uid).then(setLoaded);
  }, [status, uid, fetchList]);

  const view =
    status === "loading" || (uid && loaded?.uid !== uid)
      ? "loading"
      : !uid
        ? "signIn"
        : loaded?.result === "forbidden"
          ? "forbidden"
          : "ready";
  const list = Array.isArray(loaded?.result) ? loaded.result : [];

  const decide = async (record: WithdrawalRecord, decision: WithdrawalDecision) => {
    setBusy(true);
    try {
      const confirmed = await modal.destructive({
        titleKey: `admin.withdrawals.${decision === "accepted" ? "accept" : "refuse"}Title` as TranslationKey,
        bodyKey: `admin.withdrawals.${decision === "accepted" ? "accept" : "refuse"}Body` as TranslationKey,
        confirmKey: `admin.withdrawals.${decision === "accepted" ? "accept" : "refuse"}` as TranslationKey,
        values: { name: record.name },
      });
      if (!confirmed) return;
      await decideWithdrawalRequest(record.id, decision, notes[record.id] ?? "");
      await load();
      await modal.success({
        titleKey: "admin.withdrawals.decidedTitle",
        bodyKey: "admin.withdrawals.decidedBody",
        values: { name: record.name, status: t(`admin.withdrawals.status.${decision}` as TranslationKey) },
      });
    } catch (error) {
      await modal.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <FileX2 aria-hidden className="size-7 text-gold" />
          {t("admin.withdrawals.title")}
        </h1>
        <p className="text-ink-soft">{t("admin.withdrawals.intro", { appName })}</p>
      </section>

      {view === "loading" && (
        <p className="text-ink-soft" aria-busy>
          {t("admin.withdrawals.loading")}
        </p>
      )}

      {view === "signIn" && (
        <section className={card}>
          <p>{t("admin.withdrawals.signInNeeded")}</p>
          <Link href={`/connexion?suite=${encodeURIComponent(PAGE)}`} className={secondaryButton}>
            {t("admin.withdrawals.signIn")}
          </Link>
        </section>
      )}

      {view === "forbidden" && (
        <section className={card}>
          <ShieldAlert aria-hidden className="size-8 text-gold" />
          <p>{t("admin.withdrawals.forbidden", { appName })}</p>
        </section>
      )}

      {view === "ready" && (
        <section className={card} aria-labelledby="withdrawals-list">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="withdrawals-list" className="font-display text-xl font-semibold">
              {t("admin.withdrawals.listTitle")}
            </h2>
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => void load()}>
              <RefreshCw aria-hidden className="size-5" />
              {t("admin.withdrawals.refresh")}
            </button>
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("admin.withdrawals.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-gold/15">
              {list.map((record) => (
                <li key={record.id} className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {record.name}
                      {SEPARATOR}
                      <span className="break-all">{record.email}</span>
                    </span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${statusStyle[record.status]}`}>
                      {t(`admin.withdrawals.status.${record.status}` as TranslationKey)}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft">
                    {t("admin.withdrawals.receivedAt", { date: formatDate(record.receivedAt) })}
                    {SEPARATOR}
                    {t("admin.withdrawals.reference", { id: record.id })}
                  </p>
                  <p className="text-sm">
                    {t("admin.withdrawals.order", {
                      provider: t(`withdrawal.providers.${record.provider}` as TranslationKey, { appName }),
                      reference: record.orderReference,
                    })}
                  </p>
                  <p className="text-sm">
                    {record.orderId
                      ? t("admin.withdrawals.linkedOrder", {
                          orderId: record.orderId,
                          edition: record.editionId ? t(`editions.${record.editionId}.name` as TranslationKey) : "",
                          date: formatDate(record.paidAt),
                        })
                      : t("admin.withdrawals.notLinked")}
                  </p>
                  <p className="text-sm font-semibold text-gold">
                    {t(`admin.withdrawals.assessment.${record.assessment}` as TranslationKey)}
                  </p>
                  {record.message && (
                    <p className="text-sm text-ink-soft">{t("admin.withdrawals.message", { message: record.message })}</p>
                  )}
                  <p className="text-sm text-ink-soft">
                    {record.acknowledgementSentAt
                      ? t("admin.withdrawals.acknowledged", { date: formatDate(record.acknowledgementSentAt) })
                      : t("admin.withdrawals.notAcknowledged")}
                  </p>
                  {record.status === "received" ? (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">{t("admin.withdrawals.note")}</span>
                        <textarea
                          rows={2}
                          maxLength={1000}
                          className={`${input} py-3`}
                          value={notes[record.id] ?? ""}
                          onChange={(event) => setNotes({ ...notes, [record.id]: event.target.value })}
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className={secondaryButton}
                          disabled={busy}
                          onClick={() => void decide(record, "accepted")}
                        >
                          <Check aria-hidden className="size-5" />
                          {t("admin.withdrawals.accept")}
                        </button>
                        <button
                          type="button"
                          className={secondaryButton}
                          disabled={busy}
                          onClick={() => void decide(record, "refused")}
                        >
                          <X aria-hidden className="size-5" />
                          {t("admin.withdrawals.refuse")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-soft">
                      {t("admin.withdrawals.decidedAt", { date: formatDate(record.decidedAt) })}
                      {record.decisionNote && `${SEPARATOR}${record.decisionNote}`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <BackLink href="/" label={t("common.backHome")} />
    </main>
  );
}
