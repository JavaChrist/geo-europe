"use client";

import { Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import content from "@country";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import { useTranslation } from "@/i18n/I18nProvider";
import { NAV_ITEMS, isActive } from "./nav/items";

/** En-tête commun à tous les jeux : seule la configuration du pays change. */
export function AppHeader() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { appName, icons } = content.country;
  // Sur mobile, l'accueil affiche déjà le logo en grand.
  const visibility = pathname === "/" ? "hidden lg:flex" : "flex";
  const { entitlements, enabled } = useEntitlements();
  // Boutique : partout sauf sur l'accueil, et seulement s'il reste une édition à acheter.
  const nothingToBuy =
    entitlements.granted ||
    (entitlements.familyAccess && entitlements.adsRemoved);
  const showShop = enabled && !nothingToBuy && pathname !== "/";
  const shopActive = pathname.startsWith("/boutique");

  return (
    <header
      className={`${visibility} mx-auto w-full max-w-5xl items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))]`}
    >
      <Link
        href="/"
        className="flex min-h-12 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-gold"
      >
        <Image
          src={icons.icon192}
          alt=""
          width={44}
          height={44}
          className="rounded-xl"
          priority
        />
        <span className="font-display text-2xl font-semibold">{appName}</span>
      </Link>

      <div className="flex items-center gap-1">
        <nav aria-label={t("nav.label")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-2 rounded-xl px-3 transition-colors focus-visible:outline-2 focus-visible:outline-gold ${
                      active
                        ? "bg-gold/15 font-semibold text-gold"
                        : "text-ink-soft hover:bg-surface hover:text-ink"
                    }`}
                  >
                    <Icon aria-hidden className="size-5" />
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {showShop && (
          <Link
            href="/boutique"
            aria-current={shopActive ? "page" : undefined}
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-gold lg:flex-row lg:gap-2 lg:px-3 lg:py-0 lg:text-base lg:font-normal ${
              shopActive
                ? "bg-gold/15 font-semibold text-gold"
                : "text-ink-soft hover:bg-surface hover:text-ink"
            }`}
          >
            <Store aria-hidden className="size-6 lg:size-5" />
            <span>{t("nav.shop")}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
