import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/** Bouton de retour vers l'écran parent. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center gap-2 self-center rounded-xl border border-gold/40 px-5 font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <ArrowLeft aria-hidden className="size-5" />
      {label}
    </Link>
  );
}
