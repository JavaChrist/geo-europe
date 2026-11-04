import { ArrowLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface ComingSoonProps {
  title: string;
  body: string;
  badge: string;
  backHref: string;
  backLabel: string;
  icon?: LucideIcon;
  /** Illustration à la place de l'icône, par exemple la forme d'une région. */
  visual?: ReactNode;
  /** Lien secondaire affiché sous le bouton de retour. */
  extra?: ReactNode;
}

/** Écran d'une rubrique pas encore disponible. */
export function ComingSoon({ title, body, badge, backHref, backLabel, icon: Icon, visual, extra }: ComingSoonProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 py-10 text-center">
      <div className="fade-in flex w-full flex-col items-center gap-5 rounded-3xl border border-gold/25 bg-surface/60 px-6 py-10 shadow-lg shadow-abyss/40">
        {visual ?? (
          Icon && (
            <span className="flex size-20 items-center justify-center rounded-full border border-gold/40 bg-abyss/50">
              <Icon aria-hidden className="size-9 text-gold" />
            </span>
          )
        )}
        <span className="rounded-full border border-gold/40 px-3 py-1 text-sm text-gold">{badge}</span>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="text-ink-soft">{body}</p>
      </div>
      <Link
        href={backHref}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-gold/40 px-5 font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <ArrowLeft aria-hidden className="size-5" />
        {backLabel}
      </Link>
      {extra}
    </main>
  );
}
