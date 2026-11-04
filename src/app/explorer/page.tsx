import { ExplorerMap } from "@/features/explorer/ExplorerMap";
import { RegionList } from "@/features/explorer/RegionList";
import { getTranslator } from "@/i18n/translator";

export default function ExplorerPage() {
  const { t, tContent } = getTranslator();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold">{t("explorer.title")}</h1>
        <p className="text-ink-soft">{t("explorer.intro")}</p>
      </section>

      <section className="fade-in rounded-3xl border border-gold/25 bg-surface/50 p-3 sm:p-5">
        <ExplorerMap />
      </section>

      <RegionList />

      <p className="text-xs text-ink-soft">{tContent("country.mapCredit")}</p>
    </main>
  );
}
