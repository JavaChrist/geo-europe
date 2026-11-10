"use client";

import {
  Check,
  CircleCheck,
  FlaskConical,
  Gift,
  Info,
  Lock,
  Megaphone,
  MegaphoneOff,
  RefreshCw,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import content from "@country";
import { freeRegionIds, productIdOf } from "@/engine/entitlements";
import { paidEditions } from "@/engine/editions";
import type { Edition, EditionId } from "@/engine/types";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translator";
import { requestCheckout } from "@/services/account";
import { paymentChannel } from "@/services/api";
import { buyOnPlay, playPrices, restorePlayPurchases } from "@/services/billing";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, primaryButton, secondaryButton, textLink } from "@/ui/styles";

const offers = paidEditions(content.editions);
/** `web` : Mollie sur le site. `play` : Google Play Billing dans l'application Android, jamais Mollie. */
const channel = paymentChannel();
/**
 * Avis « mode test ». Web : tant que les éditions payantes ne sont pas `active`.
 * Google Play : toujours, tant que `PLAY_MODE` du serveur reste en test.
 */
const testOnly =
  channel === "play" ||
  !offers.every((edition) => edition.status === "active");
const productOf = (id: EditionId) => productIdOf(content.country.legal.kitAppId, id);
const nameKey = (id: EditionId) => `editions.${id}.name` as TranslationKey;

function useFreeRegionNames(): string {
  const { tContent, locale } = useTranslation();
  const names = freeRegionIds(content.editions).map((id) => {
    const region = content.regions.find((candidate) => candidate.id === id);
    return region ? tContent(region.nameKey) : id;
  });
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
}

function Feature({
  icon: Icon,
  text,
  muted = false,
}: {
  icon: typeof Check;
  text: string;
  muted?: boolean;
}) {
  return (
    <li className={`flex items-start gap-2 ${muted ? "text-ink-soft" : ""}`}>
      <Icon
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${muted ? "text-ink-soft" : "text-gold"}`}
      />
      <span>{text}</span>
    </li>
  );
}

/**
 * Boutique : les quatre éditions payantes, la commande, les droits déjà acquis. Sur le web, le prix vient de
 * `editions.ts` ; dans l'application, c'est le prix localisé de la Play Console (celui de `editions.ts` à défaut).
 */
export function Shop() {
  const { t, formatPrice } = useTranslation();
  const modal = useModal();
  const router = useRouter();
  const params = useSearchParams();
  const { account, entitlements, status, enabled } = useEntitlements();
  const freeNames = useFreeRegionNames();
  const requested = params.get("edition");
  const [selected, setSelected] = useState<EditionId | null>(
    offers.some((edition) => edition.id === requested)
      ? (requested as EditionId)
      : null,
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [immediateAccepted, setImmediateAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storePrices, setStorePrices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (channel !== "play") return;
    let active = true;
    void playPrices(offers.map((edition) => productOf(edition.id))).then((prices) => {
      if (active) setStorePrices(prices);
    });
    return () => {
      active = false;
    };
  }, []);

  const ownsAny = entitlements.editions.length > 0;
  const choice = offers.find((edition) => edition.id === selected) ?? null;
  const price = (edition: Edition) =>
    storePrices[productOf(edition.id)] ??
    formatPrice(edition.priceCents, content.editions.currency);

  const choose = (id: EditionId) => {
    setSelected(id);
    // Les cases restent décochées à chaque nouveau choix : le consentement porte sur une commande précise.
    setTermsAccepted(false);
    setImmediateAccepted(false);
    router.replace(`/boutique?edition=${id}`, { scroll: false });
  };

  const consent = () => ({
    termsAccepted,
    immediateAccessRequested: immediateAccepted,
    withdrawalWaiverAccepted: immediateAccepted,
  });

  const orderOnPlay = async (editionId: EditionId) => {
    const result = await buyOnPlay(editionId, consent());
    if (result.kind === "verified") {
      router.push(`/boutique/retour?commande=${encodeURIComponent(result.order.id)}`);
      return true;
    }
    if (result.kind === "restored") {
      await modal.success({ titleKey: "shop.restored.title", bodyKey: "shop.restored.body" });
    }
    return false;
  };

  const restoreFromPlay = async () => {
    setBusy(true);
    try {
      const count = await restorePlayPurchases();
      await (count > 0
        ? modal.success({ titleKey: "shop.restored.title", bodyKey: "shop.restored.body" })
        : modal.info({ titleKey: "shop.nothingToRestore.title", bodyKey: "shop.nothingToRestore.body" }));
    } catch (error) {
      await modal.error(error);
    }
    setBusy(false);
  };

  const order = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      if (channel === "play") {
        if (await orderOnPlay(choice.id)) return;
        setBusy(false);
        return;
      }
      const result = await requestCheckout(choice.id, consent());
      if ("checkoutUrl" in result) {
        // La page Mollie s'ouvre dans le même onglet. Le retour ne prouve rien : le serveur vérifie le paiement.
        window.location.assign(result.checkoutUrl);
        return;
      }
      router.push(
        `/boutique/retour?commande=${encodeURIComponent(result.orderId)}`,
      );
    } catch (error) {
      await modal.error(error);
    }
    setBusy(false);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold">
          {t("shop.title")}
        </h1>
        <p className="text-ink-soft">{t("shop.intro")}</p>
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
          {t("shop.discovery", { regions: freeNames })}
        </p>
      </section>

      {!enabled && (
        <section className={card}>
          <p>
            {channel === "off"
              ? t("shop.notInApp")
              : t("account.unavailable")}
          </p>
        </section>
      )}

      {enabled && testOnly && (
        <p className="flex items-start gap-2 rounded-2xl border border-sky/40 bg-sky/10 px-4 py-3 text-sm">
          <FlaskConical
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-sky"
          />
          {t("shop.testMode")}
        </p>
      )}

      {status === "offline" && (
        <p className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          {t("account.offline")}
        </p>
      )}

      {/* Accès offert : tout est déjà ouvert, aucune édition n'est proposée à l'achat. */}
      {entitlements.granted && (
        <section className={`${card} border-success/50`}>
          <p className="flex items-start gap-3">
            <Gift aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
            {t("shop.offered", { appName: content.country.appName })}
          </p>
        </section>
      )}

      {!entitlements.granted && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {offers.map((edition) => {
            const owned = entitlements.editions.includes(edition.id);
            const isSelected = selected === edition.id;
            return (
              <li
                key={edition.id}
                className={`fade-in flex flex-col gap-4 rounded-3xl border bg-surface/50 p-5 ${isSelected ? "border-gold" : "border-gold/25"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
                    {edition.mode === "family" ? (
                      <Users aria-hidden className="size-5 text-gold" />
                    ) : (
                      <User aria-hidden className="size-5 text-gold" />
                    )}
                  </span>
                  {owned && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/50 px-3 py-1 text-sm text-success">
                      <CircleCheck aria-hidden className="size-4" />
                      {t("shop.owned")}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-xl font-semibold">
                  {t(nameKey(edition.id))}
                </h2>
                <p>
                  <span className="text-2xl font-semibold text-gold">
                    {price(edition)}
                  </span>{" "}
                  <span className="text-sm text-ink-soft">{t("shop.ttc")}</span>
                </p>
                <ul className="flex flex-col gap-2 text-sm">
                  <Feature icon={Check} text={t("shop.features.allRegions")} />
                  <Feature icon={Check} text={t("shop.features.solo")} />
                  {edition.mode === "family" ? (
                    <Feature icon={Users} text={t("shop.features.family")} />
                  ) : (
                    <Feature
                      icon={Lock}
                      text={t("shop.features.noFamily")}
                      muted
                    />
                  )}
                  {edition.ads ? (
                    <Feature
                      icon={Megaphone}
                      text={t("shop.features.ads")}
                      muted
                    />
                  ) : (
                    <Feature
                      icon={MegaphoneOff}
                      text={t("shop.features.noAds")}
                    />
                  )}
                </ul>
                <p className="text-sm text-ink-soft">{t("shop.oneTime")}</p>
                <div className="mt-auto">
                  {owned ? null : ownsAny ? (
                    <p className="text-sm text-ink-soft">
                      {t("shop.upgradeUnavailable")}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className={`${isSelected ? primaryButton : secondaryButton} w-full`}
                      disabled={!enabled}
                      aria-pressed={isSelected}
                      onClick={() => choose(edition.id)}
                    >
                      {t(isSelected ? "shop.selected" : "shop.choose")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {enabled && choice && !ownsAny && !entitlements.granted && (
        <section
          className={`${card} border-gold/60`}
          aria-labelledby="shop-summary"
        >
          <h2 id="shop-summary" className="font-display text-2xl font-semibold">
            {t("shop.summaryTitle")}
          </h2>
          <p>
            {t("shop.summary", {
              edition: t(nameKey(choice.id)),
              price: price(choice),
            })}
          </p>

          {!account || !account.verified ? (
            <>
              <p className="text-ink-soft">
                {account
                  ? t("errors.unverifiedAccount.body")
                  : t("shop.accountNeeded")}
              </p>
              <Link
                href={`/connexion?suite=${encodeURIComponent(`/boutique?edition=${choice.id}`)}`}
                className={primaryButton}
              >
                {t("account.signInCta")}
              </Link>
            </>
          ) : (
            <>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-gold"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                />
                <span>{t("shop.consentTerms")}</span>
              </label>
              <Link
                href="/profil/confidentialite/conditions-de-vente"
                target="_blank"
                className={`${textLink} self-start`}
              >
                {t("shop.termsLink")}
              </Link>
              <Link href="/retractation" className={`${textLink} self-start`}>
                {t("account.withdrawalLink")}
              </Link>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-gold"
                  checked={immediateAccepted}
                  onChange={(event) =>
                    setImmediateAccepted(event.target.checked)
                  }
                />
                <span>{t("shop.consentImmediate")}</span>
              </label>
              <button
                type="button"
                className={primaryButton}
                disabled={busy || !termsAccepted || !immediateAccepted}
                onClick={() => void order()}
              >
                {t(
                  busy
                    ? channel === "play"
                      ? "shop.openingPlay"
                      : "shop.redirecting"
                    : "shop.order",
                )}
              </button>
              {channel === "play" && (
                <p className="text-sm text-ink-soft">{t("shop.playPrice")}</p>
              )}
            </>
          )}
        </section>
      )}

      {/* Application Android : un achat fait sur un autre appareil ou resté en suspens se retrouve ici. */}
      {enabled &&
        channel === "play" &&
        account?.verified &&
        !entitlements.granted && (
          <button
            type="button"
            className={`${secondaryButton} self-start`}
            disabled={busy}
            onClick={() => void restoreFromPlay()}
          >
            <RefreshCw aria-hidden className="size-5" />
            {t(busy ? "shop.restoring" : "shop.restore")}
          </button>
        )}

      <BackLink href="/" label={t("common.backHome")} />
    </main>
  );
}
