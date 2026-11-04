"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/i18n/I18nProvider";
import { NAV_ITEMS, isActive } from "./items";

/** Navigation principale sur mobile et tablette. Sur grand écran, voir AppHeader. */
export function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/25 bg-abyss/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold ${
                  active ? "font-semibold text-gold" : "text-ink-soft hover:text-ink"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-x-1/4 top-0 h-0.5 rounded-full bg-gold" />}
                <Icon aria-hidden className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
