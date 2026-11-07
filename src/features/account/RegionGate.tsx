"use client";

import { LoaderCircle, Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import content from "@country";
import { freeRegionIds } from "@/engine/entitlements";
import { useTranslation } from "@/i18n/I18nProvider";
import { BackLink } from "@/ui/BackLink";
import { card, primaryButton } from "@/ui/styles";
import { useEntitlements } from "./EntitlementsProvider";

/** Carte de verrou commune : région hors Découverte ou Mode Famille sans édition Famille. */
export function LockCard({ title, body, cta, href, back = "/explorer" }: { title: string; body: string; cta: string; href: string; back?: "/explorer" | "/" }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <section className={`${card} items-center text-center`}>
        <span className="flex size-16 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
          <Lock aria-hidden className="size-7 text-gold" />
        </span>
        <span className="rounded-full border border-gold/40 px-3 py-1 text-sm text-gold">{t("lock.badge")}</span>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="text-ink-soft">{body}</p>
        <Link href={href} className={`${primaryButton} w-full`}>
          {cta}
        </Link>
      </section>
      <BackLink href={back} label={t(back === "/" ? "common.backHome" : "explorer.backToMap")} />
    </main>
  );
}

export function CheckingAccess() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-12 text-ink-soft" aria-busy>
      <LoaderCircle aria-hidden className="size-8 animate-spin text-gold" />
      <p>{t("lock.checking")}</p>
    </main>
  );
}

/**
 * Verrou d'une région jouable. Les droits viennent de `useEntitlements()` : tant qu'ils ne sont pas connus,
 * rien n'est montré ; hors ligne ou sans compte, seule la Découverte gratuite s'ouvre.
 */
export function RegionGate({ regionId, children }: { regionId: string; children: ReactNode }) {
  const { t, tContent, locale } = useTranslation();
  const { canPlayRegion, status } = useEntitlements();
  const free = freeRegionIds(content.editions).includes(regionId);
  if (free || canPlayRegion(regionId)) return children;
  if (status === "loading") return <CheckingAccess />;

  const region = content.regions.find((candidate) => candidate.id === regionId);
  const freeNames = freeRegionIds(content.editions).map((id) => {
    const match = content.regions.find((candidate) => candidate.id === id);
    return match ? tContent(match.nameKey) : id;
  });
  return (
    <LockCard
      title={t("lock.title", { region: region ? tContent(region.nameKey) : regionId })}
      body={t("lock.body", { regions: new Intl.ListFormat(locale, { type: "conjunction" }).format(freeNames) })}
      cta={t("lock.cta")}
      href="/boutique"
    />
  );
}
