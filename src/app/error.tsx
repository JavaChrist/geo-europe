"use client";

import { useTranslation } from "@/i18n/I18nProvider";
import { toAppError } from "@/services/app-error";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  const { code } = toAppError(error);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">{t(`errors.${code}.title`)}</h1>
      <p className="text-ink-soft">{t(`errors.${code}.body`)}</p>
      <button
        type="button"
        onClick={reset}
        className="min-h-12 rounded-xl bg-gold px-5 font-semibold text-abyss transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {t("common.retry")}
      </button>
    </main>
  );
}
