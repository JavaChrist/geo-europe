"use client";

import { useEffect, useId, useRef, type MouseEvent } from "react";
import { CircleAlert, CircleCheck, CircleHelp, Info, ShoppingBag, Trash2, Trophy, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translator";
import type { ModalRequest, ModalVariant } from "./types";

const ICONS: Record<ModalVariant, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  error: CircleAlert,
  confirm: CircleHelp,
  destructive: Trash2,
  purchase: ShoppingBag,
  reward: Trophy,
};

const ICON_COLORS: Record<ModalVariant, string> = {
  info: "text-sky",
  success: "text-success",
  error: "text-danger",
  confirm: "text-gold",
  destructive: "text-danger",
  purchase: "text-gold",
  reward: "text-gold",
};

const DEFAULT_CONFIRM: Record<ModalVariant, TranslationKey> = {
  info: "common.ok",
  success: "common.ok",
  error: "common.ok",
  reward: "common.continue",
  confirm: "common.confirm",
  destructive: "common.delete",
  purchase: "common.buy",
};

const BUTTON = "min-h-12 rounded-xl px-5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

interface ModalDialogProps {
  request: ModalRequest;
  onSettled: (confirmed: boolean) => void;
}

export function ModalDialog({ request, onSettled }: ModalDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const safeButtonRef = useRef<HTMLButtonElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const confirmed = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  const { variant, content, needsChoice } = request;
  const Icon = ICONS[variant];
  const isDangerous = variant === "destructive";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // Une suppression ne doit pas pouvoir être validée par un simple appui sur Entrée.
    (isDangerous ? safeButtonRef : primaryButtonRef).current?.focus();
  }, [isDangerous]);

  // Tout passe par close() : le navigateur rend alors le focus à l'élément d'origine.
  const closeWith = (value: boolean) => {
    confirmed.current = value;
    dialogRef.current?.close();
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) closeWith(false);
  };

  return (
    <dialog
      ref={dialogRef}
      role={variant === "error" || isDangerous ? "alertdialog" : undefined}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={() => onSettled(confirmed.current)}
      onClick={handleBackdropClick}
      className="modal m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gold/30 bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="flex flex-col gap-4 p-6">
        <Icon aria-hidden className={`size-9 ${ICON_COLORS[variant]}`} />
        <h2 id={titleId} className="font-display text-2xl font-semibold">
          {t(content.titleKey, content.values)}
        </h2>
        <p id={bodyId} className="text-ink-soft">
          {t(content.bodyKey, content.values)}
        </p>
        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {needsChoice && (
            <button
              ref={safeButtonRef}
              type="button"
              onClick={() => closeWith(false)}
              className={`${BUTTON} border border-ink-soft/40 hover:bg-white/10`}
            >
              {t(content.cancelKey ?? "common.cancel")}
            </button>
          )}
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={() => closeWith(true)}
            className={`${BUTTON} ${isDangerous ? "bg-danger-solid text-white hover:bg-danger-solid/85" : "bg-gold text-abyss hover:bg-gold-light"}`}
          >
            {t(content.confirmKey ?? DEFAULT_CONFIRM[variant])}
          </button>
        </div>
      </div>
    </dialog>
  );
}
