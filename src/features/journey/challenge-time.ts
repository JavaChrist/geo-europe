import type { Translator } from "@/i18n/translator";

/** Durée d'une partie chronométrée, à la seconde près. */
export function formatChallengeTime(t: Translator["t"], timeMs: number): string {
  const total = Math.round(timeMs / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes === 0 ? t("journey.specials.durationSeconds", { seconds }) : t("journey.specials.duration", { minutes, seconds });
}

/** Temps restant au format du chronomètre, sans jamais afficher 0:00 avant la fin réelle. */
export function formatCountdown(remainingMs: number): string {
  const total = Math.ceil(remainingMs / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
