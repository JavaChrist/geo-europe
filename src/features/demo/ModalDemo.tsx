"use client";

import { useState } from "react";
import content from "@country";
import { findEdition } from "@/engine/editions";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translator";
import { AppError } from "@/services/app-error";
import { useModal } from "@/ui/modal/ModalProvider";

export function ModalDemo() {
  const { t, formatPrice } = useTranslation();
  const modal = useModal();
  const [result, setResult] = useState<TranslationKey>("demo.resultNone");
  const { country, regions, editions } = content;
  const edition = findEdition(editions, "solo_no_ads");

  const info = { titleKey: "demo.info.title", bodyKey: "demo.info.body", values: { count: regions.length } } as const;

  const report = (confirmed: boolean) => setResult(confirmed ? "demo.resultConfirmed" : "demo.resultCancelled");
  const closed = () => setResult("demo.resultClosed");

  const actions: { labelKey: TranslationKey; run: () => Promise<void> }[] = [
    { labelKey: "demo.open.info", run: () => modal.info(info).then(closed) },
    {
      labelKey: "demo.open.success",
      run: () => modal.success({ titleKey: "demo.success.title", bodyKey: "demo.success.body" }).then(closed),
    },
    { labelKey: "demo.open.error", run: () => modal.error(new AppError("network")).then(closed) },
    {
      labelKey: "demo.open.confirm",
      run: () => modal.confirm({ titleKey: "demo.confirm.title", bodyKey: "demo.confirm.body" }).then(report),
    },
    {
      labelKey: "demo.open.destructive",
      run: () => modal.destructive({ titleKey: "demo.destructive.title", bodyKey: "demo.destructive.body" }).then(report),
    },
    {
      labelKey: "demo.open.purchase",
      run: () =>
        modal
          .purchase({
            titleKey: "demo.purchase.title",
            bodyKey: "demo.purchase.body",
            values: {
              app: country.appName,
              edition: t(`editions.${edition.id}.name`),
              price: formatPrice(edition.priceCents, editions.currency),
            },
          })
          .then(report),
    },
    {
      labelKey: "demo.open.reward",
      run: () => modal.reward({ titleKey: "demo.reward.title", bodyKey: "demo.reward.body" }).then(closed),
    },
    {
      labelKey: "demo.open.queue",
      run: () => {
        void modal.info(info);
        return modal.error(new Error("détail technique jamais affiché")).then(closed);
      },
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold">{t("demo.title")}</h1>
        <p className="text-ink-soft">{t("demo.intro")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ labelKey, run }) => (
          <button
            key={labelKey}
            type="button"
            onClick={run}
            className="min-h-12 rounded-xl border border-gold/40 bg-surface px-4 font-semibold transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <p role="status" className="text-gold">
        {t("demo.lastResult", { result: t(result) })}
      </p>
    </main>
  );
}
