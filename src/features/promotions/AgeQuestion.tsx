"use client";

import { UserRound } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { AdultAnswer } from "@/engine/promotions";
import { useHoldUpdate } from "@/features/update/update-hold";
import { useTranslation } from "@/i18n/I18nProvider";
import { secondaryButton, textLink } from "@/ui/styles";

interface AgeQuestionProps {
  /** `null` : pas de réponse, la question reviendra à la prochaine promotion. */
  onAnswer: (answer: AdultAnswer) => void;
}

/**
 * Posée une seule fois, avant la première promotion. Les deux réponses ont le même poids :
 * rien n'est choisi d'avance et aucune ne débloque quoi que ce soit dans le jeu.
 */
export function AgeQuestion({ onAnswer }: AgeQuestionProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const answer = useRef<AdultAnswer>(null);
  const titleId = useId();
  const bodyId = useId();
  useHoldUpdate(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const closeWith = (value: AdultAnswer) => {
    answer.current = value;
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={() => onAnswer(answer.current)}
      className="modal m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gold/30 bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="flex flex-col gap-4 p-6">
        <UserRound aria-hidden className="size-9 text-gold" />
        <h2 id={titleId} className="font-display text-2xl font-semibold">
          {t("promo.age.title")}
        </h2>
        <div id={bodyId} className="flex flex-col gap-2">
          <p className="text-ink-soft">{t("promo.age.body")}</p>
          <p className="font-semibold">{t("promo.age.question")}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button type="button" className={secondaryButton} onClick={() => closeWith("adult")}>
            {t("promo.age.adult")}
          </button>
          <button type="button" className={secondaryButton} onClick={() => closeWith("minor")}>
            {t("promo.age.minor")}
          </button>
        </div>
        <p className="text-sm text-ink-soft">{t("promo.age.note")}</p>
        <button type="button" className={`${textLink} self-center`} onClick={() => closeWith(null)}>
          {t("promo.age.later")}
        </button>
      </div>
    </dialog>
  );
}
