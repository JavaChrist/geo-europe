"use client";

import {
  CircleCheck,
  Gift,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import content from "@country";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translator";
import {
  checkOfferedAccessAdmin,
  requestRestore,
  signOutAccount,
} from "@/services/account";
import { useModal } from "@/ui/modal/ModalProvider";
import { primaryButton, secondaryButton, textLink } from "@/ui/styles";
import { useEntitlements } from "./EntitlementsProvider";

/** Section Compte du profil : droits possédés (achats et accès offert), restauration des achats, déconnexion. */
export function AccountPanel() {
  const { t } = useTranslation();
  const modal = useModal();
  const { account, entitlements, status, enabled } = useEntitlements();
  const [busy, setBusy] = useState(false);
  // Compte reconnu administrateur par le serveur. Le lien n'ouvre rien à lui seul : la page revérifie tout.
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const uid = enabled && account?.verified ? account.uid : null;
  useEffect(() => {
    if (!uid) return;
    checkOfferedAccessAdmin().then((admin) => setAdminUid(admin ? uid : null));
  }, [uid]);
  const isAdmin = uid !== null && adminUid === uid;

  if (!enabled) return null;

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

  const restore = () =>
    run(async () => {
      await requestRestore();
      await modal.success({
        titleKey: "account.restoredTitle",
        bodyKey: "account.restoredBody",
      });
    });

  const signOut = () =>
    run(async () => {
      const confirmed = await modal.confirm({
        titleKey: "account.signOutTitle",
        bodyKey: "account.signOutBody",
        confirmKey: "account.signOut",
      });
      if (confirmed) await signOutAccount();
    });

  return (
    <section
      className="fade-in flex w-full flex-col gap-4 rounded-3xl border border-gold/25 bg-surface/50 p-5 text-left"
      aria-labelledby="account-title"
    >
      <h2
        id="account-title"
        className="flex items-center gap-2 font-display text-xl font-semibold"
      >
        <UserRound aria-hidden className="size-5 text-gold" />
        {t("account.title")}
      </h2>

      {status === "loading" ? (
        <p className="text-ink-soft">{t("account.loading")}</p>
      ) : account ? (
        <>
          <p className="text-sm text-ink-soft">
            {t("account.signedInAs", { email: account.email ?? "" })}
          </p>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">{t("account.owned")}</h3>
            {status === "offline" && (
              <p className="text-sm text-ink-soft">{t("account.offline")}</p>
            )}
            {entitlements.granted && (
              <div className="flex items-start gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
                <Gift
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-success"
                />
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">
                    {t("account.offered", { appName: content.country.appName })}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {t("account.offeredBody")}
                  </p>
                </div>
              </div>
            )}
            {entitlements.granted &&
            entitlements.editions.length === 0 ? null : entitlements.editions
                .length === 0 ? (
              <p className="text-sm text-ink-soft">{t("account.ownedNone")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {entitlements.editions.map((id) => (
                  <li key={id} className="flex items-center gap-2">
                    <CircleCheck aria-hidden className="size-4 text-success" />
                    {t(`editions.${id}.name` as TranslationKey)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className={secondaryButton}
            disabled={busy}
            onClick={() => void restore()}
          >
            <RefreshCw aria-hidden className="size-5" />
            {t("account.restore")}
          </button>
          {isAdmin && (
            <Link href="/admin/acces-offerts" className={secondaryButton}>
              <ShieldCheck aria-hidden className="size-5" />
              {t("account.adminLink")}
            </Link>
          )}
          <button
            type="button"
            className={`${textLink} self-center`}
            disabled={busy}
            onClick={() => void signOut()}
          >
            <LogOut aria-hidden className="mr-1 size-4" />
            {t("account.signOut")}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">{t("account.intro")}</p>
          <Link href="/connexion?suite=%2Fboutique" className={secondaryButton}>
            {t("account.signInCta")}
          </Link>
        </>
      )}

      {/* Un accès offert ouvre déjà tout : la boutique n'a plus rien à proposer. */}
      {!entitlements.granted && (
        <Link href="/boutique" className={primaryButton}>
          <ShoppingBag aria-hidden className="size-5" />
          {t("shop.open")}
        </Link>
      )}
    </section>
  );
}
