"use client";

import { CircleAlert, CircleCheck, CircleX, Clock, LoaderCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translator";
import { requestOrderSync, type OrderState } from "@/services/account";
import { BackLink } from "@/ui/BackLink";
import { card, primaryButton, secondaryButton } from "@/ui/styles";

/** Écrans de résultat. Le retour depuis Mollie ne prouve rien : seul l'état relu par le serveur compte. */
type Screen = "checking" | "paid" | "canceled" | "failed" | "expired" | "pending" | "refunded" | "problem";

const POLL_MS = 3000;
const MAX_POLLS = 20;

function screenOf(status: string): Screen {
  switch (status) {
    case "paid":
      return "paid";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    case "failed":
    case "error":
      return "failed";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "pending":
    case "authorized":
      return "pending";
    default:
      return "checking";
  }
}

const ICONS: Record<Screen, { icon: LucideIcon; tone: string }> = {
  checking: { icon: LoaderCircle, tone: "text-sky animate-spin" },
  paid: { icon: CircleCheck, tone: "text-success" },
  canceled: { icon: CircleX, tone: "text-ink-soft" },
  failed: { icon: CircleX, tone: "text-danger" },
  expired: { icon: Clock, tone: "text-ink-soft" },
  pending: { icon: Clock, tone: "text-gold" },
  refunded: { icon: CircleAlert, tone: "text-ink-soft" },
  problem: { icon: CircleAlert, tone: "text-gold" },
};

export function PaymentReturn() {
  const { t } = useTranslation();
  const orderId = useSearchParams().get("commande");
  const { account, status } = useEntitlements();
  const [order, setOrder] = useState<OrderState | null>(null);
  const [screen, setScreen] = useState<Screen>("checking");
  const polls = useRef(0);
  const uid = account?.uid;

  const check = useCallback(async (): Promise<Screen> => {
    if (!orderId) return "problem";
    try {
      const state = await requestOrderSync(orderId);
      setOrder(state);
      return screenOf(state.status);
    } catch {
      return "problem";
    }
  }, [orderId]);

  // Relecture régulière tant que le paiement n'a pas de résultat définitif, puis arrêt.
  useEffect(() => {
    if (!uid) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    polls.current = 0;
    const tick = async () => {
      const next = await check();
      if (stopped) return;
      polls.current += 1;
      const waiting = next === "checking" || next === "pending";
      if (waiting && polls.current < MAX_POLLS) {
        setScreen(next);
        timer = setTimeout(() => void tick(), POLL_MS);
      } else {
        setScreen(next === "checking" ? "pending" : next);
      }
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [uid, check]);

  const refresh = async () => {
    setScreen("checking");
    const next = await check();
    setScreen(next === "checking" ? "pending" : next);
  };

  if (status !== "loading" && !account) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
        <section className={card}>
          <h1 className="font-display text-3xl font-semibold">{t("payment.title")}</h1>
          <p className="text-ink-soft">{t("payment.signInAgain")}</p>
          <Link href={`/connexion?suite=${encodeURIComponent(`/boutique/retour?commande=${orderId ?? ""}`)}`} className={primaryButton}>
            {t("account.signInCta")}
          </Link>
        </section>
      </main>
    );
  }

  const { icon: Icon, tone } = ICONS[screen];
  const editionName = order ? t(`editions.${order.editionId}.name` as TranslationKey) : "";
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <section className={`${card} items-center text-center`} aria-live="polite" aria-busy={screen === "checking"}>
        <Icon aria-hidden className={`size-12 ${tone}`} />
        <h1 className="font-display text-3xl font-semibold">{t(`payment.${screen}.title` as TranslationKey)}</h1>
        <p className="text-ink-soft">{t(`payment.${screen}.body` as TranslationKey, { edition: editionName })}</p>
        {screen === "paid" && (
          <Link href="/" className={`${primaryButton} w-full`}>
            {t("payment.play")}
          </Link>
        )}
        {(screen === "canceled" || screen === "failed" || screen === "expired") && (
          <Link href={order ? `/boutique?edition=${order.editionId}` : "/boutique"} className={`${primaryButton} w-full`}>
            {t("payment.retry")}
          </Link>
        )}
        {(screen === "pending" || screen === "problem") && (
          <button type="button" className={`${secondaryButton} w-full`} onClick={() => void refresh()}>
            {t("payment.refresh")}
          </button>
        )}
      </section>
      <BackLink href="/boutique" label={t("shop.back")} />
    </main>
  );
}
