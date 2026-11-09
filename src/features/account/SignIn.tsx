"use client";

import { Eye, EyeOff, LogIn, MailCheck, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n/I18nProvider";
import {
  reloadAccount,
  resendVerification,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutAccount,
  signUpWithEmail,
} from "@/services/account";
import { AppError } from "@/services/app-error";
import { BackLink } from "@/ui/BackLink";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, input, primaryButton, secondaryButton, textLink } from "@/ui/styles";
import { useEntitlements } from "./EntitlementsProvider";

/** Seul un retour vers la boutique est accepté : aucune redirection vers une adresse fournie de l'extérieur. */
/** Pages où la connexion peut ramener : rien d'autre, pour qu'un lien ne puisse pas renvoyer ailleurs. */
const NEXT_PAGES = ["/boutique", "/admin/acces-offerts"];

export function safeNext(value: string | null): string {
  if (!value || !NEXT_PAGES.some((page) => value.startsWith(page)) || value.startsWith("//") || value.includes("\\")) return "/boutique";
  return value;
}

const MIN_PASSWORD = 8;
/** Même délai que la limite du serveur entre deux envois à une adresse. */
const RESEND_DELAY_MS = 60_000;

/** Connexion avant achat : Google ou adresse électronique vérifiée. Le jeu gratuit n'en a jamais besoin. */
export function SignIn() {
  const { t } = useTranslation();
  const modal = useModal();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("suite"));
  const { account, status, enabled } = useEntitlements();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  // Compte dont le serveur a confirmé l'envoi du lien pendant cette visite. Sans cette confirmation,
  // l'écran ne dit jamais « lien envoyé ».
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Après un envoi réussi, « Renvoyer le lien » attend la fin de la limite du serveur (un envoi par minute).
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= cooldownUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  /** Demande le lien au serveur ; `linkSentTo` n'est rempli qu'après sa réponse positive. */
  const sendLink = async (send: () => Promise<{ uid: string }>) => {
    setSending(true);
    try {
      setLinkSentTo((await send()).uid);
      const sentAt = Date.now();
      setNow(sentAt);
      setCooldownUntil(sentAt + RESEND_DELAY_MS);
    } finally {
      setSending(false);
    }
  };

  // Compte permanent : retour direct vers l'édition choisie.
  useEffect(() => {
    if (account?.verified) router.replace(next);
  }, [account, next, router]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      await modal.error(error);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (mode === "signUp" && password.length < MIN_PASSWORD) throw new AppError("weakPassword");
      // `signUpWithEmail` lève une erreur si le lien n'est pas parti : `linkSentTo` reste alors vide.
      if (mode === "signUp") await sendLink(() => signUpWithEmail(email.trim(), password));
      else await signInWithEmail(email.trim(), password);
    });
  };

  const forgot = () =>
    void run(async () => {
      if (!email.trim()) {
        await modal.info({ titleKey: "account.forgot", bodyKey: "account.resetEmailMissing" });
        return;
      }
      await sendPasswordReset(email.trim());
      await modal.info({ titleKey: "account.resetTitle", bodyKey: "account.resetBody", values: { email: email.trim() } });
    });

  if (!enabled) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
        <section className={card}>
          <h1 className="font-display text-3xl font-semibold">{t("account.title")}</h1>
          <p className="text-ink-soft">{t("account.unavailable")}</p>
        </section>
        <BackLink href="/" label={t("common.backHome")} />
      </main>
    );
  }

  if (status === "loading" || account?.verified) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-12" aria-busy>
        <p className="text-ink-soft">{t("account.loading")}</p>
      </main>
    );
  }

  // Compte créé par adresse électronique, pas encore confirmé.
  if (account) {
    const recheck = () =>
      void run(async () => {
        const refreshed = await reloadAccount();
        if (refreshed?.verified) router.replace(next);
        else await modal.info({ titleKey: "account.verifyStill", bodyKey: "account.verifyStillBody" });
      });
    const linkSent = linkSentTo === account.uid;
    const resend = () =>
      void run(async () => {
        await sendLink(async () => {
          await resendVerification();
          return account;
        });
        await modal.success({ titleKey: "account.verifyResent", bodyKey: "account.verifyResentBody", values: { email: account.email ?? "" } });
      });
    const values = { email: account.email ?? "" };
    // Lien confirmé par le serveur, envoi en cours, ou rien de confirmé (échec, ou retour plus tard sur la page).
    const body = sending ? "account.verifySending" : linkSent ? "account.verifyBody" : "account.verifyPending";
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
        <section className={card}>
          <MailCheck aria-hidden className="size-10 text-gold" />
          <h1 className="font-display text-3xl font-semibold">{t("account.verifyTitle")}</h1>
          <p className="text-ink-soft" aria-live="polite">
            {t(body, values)}
          </p>
          <button type="button" className={linkSent ? primaryButton : secondaryButton} disabled={busy} onClick={recheck}>
            {t("account.verifyDone")}
          </button>
          <button type="button" className={linkSent ? secondaryButton : primaryButton} disabled={busy || cooldown > 0} onClick={resend}>
            {cooldown > 0
              ? t("account.verifyResendIn", { seconds: String(cooldown) })
              : t(linkSent ? "account.verifyResend" : "account.verifySend")}
          </button>
          <button type="button" className={`${textLink} self-center`} disabled={busy} onClick={() => void run(signOutAccount)}>
            {t("account.signOut")}
          </button>
        </section>
      </main>
    );
  }

  const signUp = mode === "signUp";
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <section className="fade-in flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold">{t(signUp ? "account.signUpTitle" : "account.signInTitle")}</h1>
        <p className="text-ink-soft">{t("account.intro")}</p>
      </section>

      <section className={card}>
        <button type="button" className={primaryButton} disabled={busy} onClick={() => void run(signInWithGoogle)}>
          <LogIn aria-hidden className="size-5" />
          {t("account.google")}
        </button>

        <p className="flex items-center gap-3 text-sm text-ink-soft before:h-px before:flex-1 before:bg-gold/25 after:h-px after:flex-1 after:bg-gold/25">
          {t("account.or")}
        </p>

        <form className="flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("account.email")}</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              className={input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("account.password")}</span>
            <span className="relative flex">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={signUp ? MIN_PASSWORD : undefined}
                autoComplete={signUp ? "new-password" : "current-password"}
                className={`${input} pr-14`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
                aria-label={t(showPassword ? "account.hidePassword" : "account.showPassword")}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
              </button>
            </span>
            {signUp && <span className="text-sm text-ink-soft">{t("account.passwordHint")}</span>}
          </label>
          <button type="submit" className={secondaryButton} disabled={busy}>
            {signUp ? <UserPlus aria-hidden className="size-5" /> : <LogIn aria-hidden className="size-5" />}
            {t(signUp ? "account.signUp" : "account.signIn")}
          </button>
        </form>

        <div className="flex flex-col items-center gap-1">
          {!signUp && (
            <button type="button" className={textLink} disabled={busy} onClick={forgot}>
              {t("account.forgot")}
            </button>
          )}
          <button type="button" className={textLink} onClick={() => setMode(signUp ? "signIn" : "signUp")}>
            {t(signUp ? "account.toSignIn" : "account.toSignUp")}
          </button>
        </div>
      </section>

      <p className="text-center text-sm text-ink-soft">{t("account.progressKept")}</p>
      <BackLink href={next} label={t("shop.back")} />
    </main>
  );
}
