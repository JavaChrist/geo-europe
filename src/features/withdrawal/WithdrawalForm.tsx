"use client";

import { CircleCheck, FileX2, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import content from "@country";
import { WITHDRAWAL_PROVIDERS, type WithdrawalProvider } from "@/engine/withdrawal";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translator";
import { listOwnOrders, submitWithdrawal, type OwnOrder, type WithdrawalReceipt } from "@/services/account";
import { paymentChannel } from "@/services/api";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, input, primaryButton, textLink } from "@/ui/styles";

const appName = content.country.appName;
const supportEmail = content.country.legal.supportEmail;
const TERMS = "/profil/confidentialite/conditions-de-vente";
const OTHER = "";

/** Sans serveur (export Android sans `NEXT_PUBLIC_API_BASE_URL`), la demande se fait par email au support. */
const serverAvailable = paymentChannel() !== "off";

/**
 * Fonction de rétractation en ligne, accessible sans connexion (voir `docs/retractation.md`).
 * Connecté, l'adresse du compte et ses achats préremplissent le formulaire ; tout reste modifiable.
 * Le serveur horodate la demande, l'enregistre et envoie l'accusé de réception : rien n'est remboursé ici.
 */
export function WithdrawalForm() {
  const { t, locale } = useTranslation();
  const modal = useModal();
  const { account } = useEntitlements();

  // `null` : champ jamais modifié, la valeur affichée vient du compte connecté.
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [provider, setProvider] = useState<WithdrawalProvider>("mollie");
  const [reference, setReference] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<(WithdrawalReceipt & { email: string }) | null>(null);
  const [owned, setOwned] = useState<{ uid: string; orders: OwnOrder[] } | null>(null);

  const uid = account?.uid ?? null;
  useEffect(() => {
    if (!uid || !serverAvailable) return;
    listOwnOrders(uid).then((orders) => setOwned({ uid, orders }));
  }, [uid]);
  const orders = owned && owned.uid === uid ? owned.orders : [];

  const nameValue = name ?? account?.displayName ?? "";
  const emailValue = email ?? account?.email ?? "";
  const referenceValue = reference ?? (provider === "mollie" ? (orders[0]?.id ?? "") : "");
  const chosenOrder = provider === "mollie" ? orders.find((order) => order.id === referenceValue) : undefined;

  const formatDate = (value: string, withTime = false) =>
    new Intl.DateTimeFormat(locale, withTime ? { dateStyle: "long", timeStyle: "long" } : { dateStyle: "long" }).format(
      new Date(value),
    );
  const editionName = (order: OwnOrder) => t(`editions.${order.editionId}.name` as TranslationKey);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await submitWithdrawal({
        name: nameValue,
        email: emailValue,
        provider,
        orderReference: referenceValue,
        message,
      });
      setReceipt({ ...result, email: emailValue.trim().toLowerCase() });
      window.scrollTo({ top: 0 });
    } catch (error) {
      await modal.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="fade-in flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <FileX2 aria-hidden className="size-7 text-gold" />
          {t("withdrawal.title")}
        </h1>
        {!receipt && <p className="text-ink-soft">{t("withdrawal.intro", { appName })}</p>}
      </section>

      {!serverAvailable ? (
        <section className={card}>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Mail aria-hidden className="size-5 text-gold" />
            {t("withdrawal.unavailableTitle")}
          </h2>
          <p>{t("withdrawal.unavailableBody", { contact: supportEmail })}</p>
          <a href={`mailto:${supportEmail}`} className={`${textLink} self-start`}>
            {supportEmail}
          </a>
        </section>
      ) : receipt ? (
        <section className={`${card} border-success/50`} role="status">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <CircleCheck aria-hidden className="size-6 text-success" />
            {t("withdrawal.doneTitle")}
          </h2>
          <p>{t("withdrawal.doneBody", { date: formatDate(receipt.receivedAt, true), id: receipt.requestId })}</p>
          <p>
            {t(receipt.acknowledgementSent ? "withdrawal.doneMail" : "withdrawal.doneMailLater", {
              email: receipt.email,
            })}
          </p>
          <p className="text-ink-soft">{t("withdrawal.doneNext")}</p>
        </section>
      ) : (
        <form className={card} onSubmit={(event) => void submit(event)}>
          <p className="rounded-2xl border border-gold/25 bg-abyss/40 p-4 text-sm text-ink-soft">
            {t("withdrawal.notice")}
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("withdrawal.name")}</span>
            <input
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              className={input}
              value={nameValue}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("withdrawal.email")}</span>
            <input
              type="email"
              required
              autoComplete="email"
              spellCheck={false}
              className={input}
              value={emailValue}
              onChange={(event) => setEmail(event.target.value)}
            />
            <span className="text-sm text-ink-soft">{t("withdrawal.emailHelp")}</span>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{t("withdrawal.provider")}</legend>
            {WITHDRAWAL_PROVIDERS.map((option) => (
              <label key={option} className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="provider"
                  className="size-5 accent-gold"
                  checked={provider === option}
                  onChange={() => {
                    setProvider(option);
                    setReference(null);
                  }}
                />
                <span>{t(`withdrawal.providers.${option}` as TranslationKey, { appName })}</span>
              </label>
            ))}
          </fieldset>

          {provider === "mollie" && orders.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{t("withdrawal.yourOrders")}</span>
              <select
                className={input}
                value={chosenOrder ? chosenOrder.id : OTHER}
                onChange={(event) => setReference(event.target.value)}
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {t("withdrawal.orderOption", {
                      edition: editionName(order),
                      date: formatDate(order.paidAt ?? ""),
                      id: order.id,
                    })}
                  </option>
                ))}
                <option value={OTHER}>{t("withdrawal.otherOrder")}</option>
              </select>
            </label>
          )}

          {!chosenOrder && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{t("withdrawal.orderReference")}</span>
              <input
                required
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                className={input}
                value={referenceValue}
                placeholder={provider === "google_play" ? "GPA.0000-0000-0000-00000" : undefined}
                onChange={(event) => setReference(event.target.value)}
              />
              <span className="text-sm text-ink-soft">
                {t(provider === "mollie" ? "withdrawal.orderHelpMollie" : "withdrawal.orderHelpGooglePlay")}
              </span>
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("withdrawal.message")}</span>
            <textarea
              maxLength={1000}
              rows={4}
              className={`${input} py-3`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <p className="text-sm">{t("withdrawal.declaration")}</p>
          <button type="submit" className={primaryButton} disabled={busy}>
            {t(busy ? "withdrawal.sending" : "withdrawal.confirm")}
          </button>
        </form>
      )}

      <Link href={TERMS} className={`${textLink} self-center`}>
        {t("withdrawal.termsLink")}
      </Link>
      <BackLink href="/" label={t("common.backHome")} />
    </main>
  );
}
