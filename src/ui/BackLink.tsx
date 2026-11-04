import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { MouseEventHandler } from "react";

/** Bouton de retour vers l'écran parent. */
export function BackLink({ href, label, onClick }: { href: string; label: string; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex min-h-12 items-center gap-2 self-center rounded-xl border border-gold/40 px-5 font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <ArrowLeft aria-hidden className="size-5" />
      {label}
    </Link>
  );
}
