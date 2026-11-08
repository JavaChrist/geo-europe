"use client";

import { CircleAlert, CircleCheck, Eye, EyeOff, KeyRound, MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "@/i18n/I18nProvider";
import { checkPasswordResetLink, confirmEmailLink, confirmPasswordResetLink } from "@/services/account";
import { AppError } from "@/services/app-error";
import { useModal } from "@/ui/modal/ModalProvider";
import { card, input, primaryButton, secondaryButton } from "@/ui/styles";
import { useEntitlements } from "./EntitlementsProvider";

const MIN_PASSWORD = 8;

type LinkState =
  | { step: "checking" }
  | { step: "invalid" }
  | { step: "verify"; code: string }
  | { step: "verified" }
  | { step: "reset"; code: string; email: string }
  | { step: "resetDone" };

/**
 * Lit le lien une seule fois et retire aussitôt le code à usage unique de la barre d'adresse et de l'historique.
 * Le lien de nouveau mot de passe est vérifié sans être consommé.
 */
async function readLink(enabled: boolean): Promise<LinkState> {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const code = params.get("oobCode");
  window.history.replaceState(null, "", window.location.pathname);
  if (!enabled || !code) return { step: "invalid" };
  if (mode === "verifyEmail") return { step: "verify", code };
  if (mode === "resetPassword") return { step: "reset", code, email: await checkPasswordResetLink(code) };
  return { step: "invalid" };
}

/**
 * Page ouverte depuis les courriels du Mail-Kit, à la place de la page générique de Firebase :
 * confirmation de l'adresse et choix d'un nouveau mot de passe.
 */
export function AuthLink() {
  const { t } = useTranslation();
  const modal = useModal();
  const { enabled } = useEntitlements();
  const [state, setState] = useState<LinkState>({ step: "checking" });
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const read = useRef(false);

  useEffect(() => {
    // Lu une seule fois, même quand React rejoue l'effet en développement.
    if (read.current) return;
    read.current = true;
    readLink(enabled).then(setState, async (error: unknown) => {
      setState({ step: "invalid" });
      await modal.error(error);
    });
  }, [enabled, modal]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      if (error instanceof AppError && error.code === "actionLinkInvalid") setState({ step: "invalid" });
      await modal.error(error);
    } finally {
      setBusy(false);
    }
  };

  const confirmEmail = (code: string) =>
    void run(async () => {
      await confirmEmailLink(code);
      setState({ step: "verified" });
    });

  const submitPassword = (event: FormEvent, code: string) => {
    event.preventDefault();
    void run(async () => {
      if (password.length < MIN_PASSWORD) throw new AppError("weakPassword");
      await confirmPasswordResetLink(code, password);
      setPassword("");
      setState({ step: "resetDone" });
    });
  };

  if (state.step === "checking") {
    return (
      <Screen>
        <p className="text-center text-ink-soft" aria-busy>
          {t("account.link.checking")}
        </p>
      </Screen>
    );
  }

  if (state.step === "verify") {
    return (
      <Screen>
        <section className={card}>
          <MailCheck aria-hidden className="size-10 text-gold" />
          <h1 className="font-display text-3xl font-semibold">{t("account.link.verifyTitle")}</h1>
          <p className="text-ink-soft">{t("account.link.verifyBody")}</p>
          <button type="button" className={primaryButton} disabled={busy} onClick={() => confirmEmail(state.code)}>
            {t(busy ? "account.link.verifying" : "account.link.verifyAction")}
          </button>
        </section>
      </Screen>
    );
  }

  if (state.step === "verified") {
    return (
      <Screen>
        <section className={card}>
          <CircleCheck aria-hidden className="size-10 text-gold" />
          <h1 className="font-display text-3xl font-semibold">{t("account.link.verifiedTitle")}</h1>
          <p className="text-ink-soft">{t("account.link.verifiedBody")}</p>
          {/* Rechargement complet : le compte est relu avec son adresse confirmée. */}
          <a href="/boutique" className={primaryButton}>
            {t("account.link.continue")}
          </a>
        </section>
      </Screen>
    );
  }

  if (state.step === "reset") {
    const code = state.code;
    return (
      <Screen>
        <section className={card}>
          <KeyRound aria-hidden className="size-10 text-gold" />
          <h1 className="font-display text-3xl font-semibold">{t("account.link.resetTitle")}</h1>
          <p className="text-ink-soft">{t("account.link.resetBody", { email: state.email })}</p>
          <form className="flex flex-col gap-4" onSubmit={(event) => submitPassword(event, code)}>
            {/* Aide les gestionnaires de mots de passe à associer le nouveau mot de passe au bon compte. */}
            <input type="email" autoComplete="username" value={state.email} readOnly hidden />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{t("account.password")}</span>
              <span className="relative flex">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={MIN_PASSWORD}
                  autoComplete="new-password"
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
              <span className="text-sm text-ink-soft">{t("account.passwordHint")}</span>
            </label>
            <button type="submit" className={primaryButton} disabled={busy}>
              {t(busy ? "account.link.resetting" : "account.link.resetAction")}
            </button>
          </form>
        </section>
      </Screen>
    );
  }

  if (state.step === "resetDone") {
    return (
      <Screen>
        <section className={card}>
          <CircleCheck aria-hidden className="size-10 text-gold" />
          <h1 className="font-display text-3xl font-semibold">{t("account.link.resetDoneTitle")}</h1>
          <p className="text-ink-soft">{t("account.link.resetDoneBody")}</p>
          <Link href="/connexion" className={primaryButton}>
            {t("account.link.signIn")}
          </Link>
        </section>
      </Screen>
    );
  }

  return (
    <Screen>
      <section className={card}>
        <CircleAlert aria-hidden className="size-10 text-gold" />
        <h1 className="font-display text-3xl font-semibold">{t("account.link.invalidTitle")}</h1>
        <p className="text-ink-soft">{t("account.link.invalidBody")}</p>
        <Link href="/connexion" className={secondaryButton}>
          {t("account.link.toSignIn")}
        </Link>
      </section>
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">{children}</main>;
}
