import { BookOpen, House, Map as MapIcon, Swords, UserRound, type LucideIcon } from "lucide-react";
import type { TranslationKey } from "@/i18n/translator";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Pages rattachées à cette rubrique sans en être des sous-chemins. */
  also?: string[];
}

/** Même ordre sur tous les écrans et dans tous les jeux de la collection. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: House, also: ["/famille"] },
  { href: "/explorer", labelKey: "nav.explorer", icon: MapIcon },
  { href: "/defis", labelKey: "nav.challenges", icon: Swords },
  { href: "/album", labelKey: "nav.album", icon: BookOpen },
  { href: "/profil", labelKey: "nav.profile", icon: UserRound },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.also?.includes(pathname)) return true;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
