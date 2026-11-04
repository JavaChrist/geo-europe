import Link from "next/link";
import { getTranslator } from "@/i18n/translator";

export default function NotFound() {
  const { t } = getTranslator();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-ink-soft">{t("notFound.body")}</p>
      <Link
        href="/"
        className="inline-flex min-h-12 items-center rounded-xl bg-gold px-5 font-semibold text-abyss transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {t("common.backHome")}
      </Link>
    </main>
  );
}
