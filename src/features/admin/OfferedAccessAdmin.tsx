"use client";

import {
  Gift,
  RefreshCw,
  ShieldAlert,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import content from "@country";
import type { GrantRecord, GrantStatus } from "@/engine/grants";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translator";
import {
  addOfferedAccess,
  listOfferedAccess,
  revokeOfferedAccess,
} from "@/services/account";
import { AppError } from "@/services/app-error";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, input, primaryButton, secondaryButton } from "@/ui/styles";

const appName = content.country.appName;
const statusKey = (status: GrantStatus) =>
  `admin.grants.status.${status}` as TranslationKey;
const statusStyle: Record<GrantStatus, string> = {
  active: "border-success/50 text-success",
  pending: "border-sky/50 text-sky",
  revoked: "border-ink-soft/40 text-ink-soft",
};

type View =
  | { step: "loading" }
  | { step: "signIn" }
  | { step: "forbidden" }
  | { step: "ready"; grants: GrantRecord[] };

/** Réponse du serveur pour un compte donné : la vue en découle, sans état recopié dans un effet. */
type Loaded = { uid: string; result: "forbidden" | GrantRecord[] };

/**
 * Administration des accès offerts de l'application du pays. Le serveur vérifie l'administrateur à chaque appel :
 * cet écran n'ouvre aucun droit à lui seul, et la liste n'est jamais lue directement dans Firestore.
 */
export function OfferedAccessAdmin() {
  const { t, locale } = useTranslation();
  const modal = useModal();
  const { account, status } = useEntitlements();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "";

  const uid = account?.uid;
  /** Lit la liste sur le serveur ; un refus 403 affiche l'écran « non autorisé », jamais la liste. */
  const fetchGrants = useCallback(
    (forUid: string): Promise<Loaded> =>
      listOfferedAccess().then(
        (grants) => ({ uid: forUid, result: grants }),
        async (error: unknown) => {
          if (error instanceof AppError && error.code === "forbidden")
            return { uid: forUid, result: "forbidden" as const };
          await modal.error(error);
          return { uid: forUid, result: [] };
        },
      ),
    [modal],
  );
  const load = useCallback(async () => {
    if (uid) setLoaded(await fetchGrants(uid));
  }, [uid, fetchGrants]);

  useEffect(() => {
    if (status === "loading" || !uid) return;
    fetchGrants(uid).then(setLoaded);
  }, [status, uid, fetchGrants]);

  const view: View =
    status === "loading"
      ? { step: "loading" }
      : !uid
        ? { step: "signIn" }
        : loaded?.uid !== uid
          ? { step: "loading" }
          : loaded.result === "forbidden"
            ? { step: "forbidden" }
            : { step: "ready", grants: loaded.result };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      await modal.error(error);
    } finally {
      setBusy(false);
    }
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const grant = await addOfferedAccess(email);
      setEmail("");
      await load();
      await modal.success({
        titleKey: "admin.grants.addedTitle",
        bodyKey:
          grant.status === "active"
            ? "admin.grants.addedActive"
            : "admin.grants.addedPending",
        values: { email: grant.email },
      });
    });
  };

  const revoke = (grant: GrantRecord) =>
    void run(async () => {
      const confirmed = await modal.destructive({
        titleKey: "admin.grants.revokeTitle",
        bodyKey: "admin.grants.revokeBody",
        confirmKey: "admin.grants.revoke",
        values: { email: grant.email },
      });
      if (!confirmed) return;
      await revokeOfferedAccess(grant.email);
      await load();
      await modal.success({
        titleKey: "admin.grants.revokedTitle",
        bodyKey: "admin.grants.revokedBody",
        values: { email: grant.email },
      });
    });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Gift aria-hidden className="size-7 text-gold" />
          {t("admin.grants.title")}
        </h1>
        <p className="text-ink-soft">{t("admin.grants.intro", { appName })}</p>
      </section>

      {view.step === "loading" && (
        <p className="text-ink-soft" aria-busy>
          {t("admin.grants.loading")}
        </p>
      )}

      {view.step === "signIn" && (
        <section className={card}>
          <p>{t("admin.grants.signInNeeded")}</p>
          <Link
            href={`/connexion?suite=${encodeURIComponent("/admin/acces-offerts")}`}
            className={primaryButton}
          >
            {t("admin.grants.signIn")}
          </Link>
        </section>
      )}

      {view.step === "forbidden" && (
        <section className={card}>
          <ShieldAlert aria-hidden className="size-8 text-gold" />
          <p>{t("admin.grants.forbidden", { appName })}</p>
        </section>
      )}

      {view.step === "ready" && (
        <>
          <form className={card} onSubmit={add}>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                {t("admin.grants.email")}
              </span>
              <input
                type="email"
                required
                autoComplete="off"
                spellCheck={false}
                className={input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className={primaryButton}
              disabled={busy || email.trim().length === 0}
            >
              <UserPlus aria-hidden className="size-5" />
              {t(busy ? "admin.grants.adding" : "admin.grants.add")}
            </button>
          </form>

          <section className={card} aria-labelledby="grants-list">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="grants-list"
                className="font-display text-xl font-semibold"
              >
                {t("admin.grants.listTitle")}
              </h2>
              <button
                type="button"
                className={secondaryButton}
                disabled={busy}
                onClick={() => void run(load)}
              >
                <RefreshCw aria-hidden className="size-5" />
                {t("admin.grants.refresh")}
              </button>
            </div>
            {view.grants.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("admin.grants.empty")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-gold/15">
                {view.grants.map((grant) => (
                  <li
                    key={grant.email}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="break-all font-semibold">
                        {grant.email}
                      </span>
                      <span className="text-sm text-ink-soft">
                        {t("admin.grants.addedAt", {
                          date: formatDate(grant.addedAt),
                        })}
                        {grant.status === "active" &&
                          grant.activatedAt &&
                          ` · ${t("admin.grants.activatedAt", { date: formatDate(grant.activatedAt) })}`}
                        {grant.status === "revoked" &&
                          grant.revokedAt &&
                          ` · ${t("admin.grants.revokedAt", { date: formatDate(grant.revokedAt) })}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm ${statusStyle[grant.status]}`}
                      >
                        {t(statusKey(grant.status))}
                      </span>
                      {grant.status !== "revoked" && (
                        <button
                          type="button"
                          className={secondaryButton}
                          disabled={busy}
                          onClick={() => revoke(grant)}
                        >
                          <UserMinus aria-hidden className="size-5" />
                          {t("admin.grants.revoke")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <BackLink href="/" label={t("common.backHome")} />
    </main>
  );
}
