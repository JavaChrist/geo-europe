"use client";

import Image from "next/image";
import content from "@country";
import { answerStateOf, isAnswerAvailable, type LevelRun } from "@/engine/level-run";
import type { MapChallenge, VisualChallenge } from "@/engine/types";
import { useTranslation } from "@/i18n/I18nProvider";

/** Photo d'un défi, toujours accompagnée de son crédit. */
export function ChallengePhoto({ challenge }: { challenge: VisualChallenge }) {
  const { t, tContent } = useTranslation();
  const credit = content.credits.find((candidate) => candidate.id === challenge.mediaId);
  if (!credit) return null;

  const linkClass = "underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-gold";

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-gold/20 bg-abyss/60 sm:h-96">
        <Image
          src={credit.file}
          alt={credit.altKey ? tContent(credit.altKey) : ""}
          fill
          sizes="(min-width: 672px) 640px, 100vw"
          className="object-contain"
        />
      </div>
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
        <a href={credit.source} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {t("journey.game.photoCredit", { author: credit.author })}
        </a>
        {credit.licenseUrl ? (
          <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {credit.license}
          </a>
        ) : (
          <span>{credit.license}</span>
        )}
      </figcaption>
    </figure>
  );
}

interface ChallengeMapProps {
  challenge: MapChallenge;
  run: LevelRun;
  onAnswer: (answerId: string) => void;
}

/** Carte à toucher : chaque zone est une réponse, accessible aussi au clavier. */
export function ChallengeMap({ challenge, run, onAnswer }: ChallengeMapProps) {
  const { t, tContent } = useTranslation();
  const map = content.gameMaps.find((candidate) => candidate.id === challenge.mapId);
  if (!map) return null;

  return (
    <svg
      viewBox={map.viewBox}
      role="group"
      aria-label={t("journey.game.mapLabel")}
      className="game-map mx-auto block h-auto max-h-[60dvh] w-full rounded-2xl border border-gold/20 bg-abyss/40 p-2"
    >
      {map.zones.map((zone) => {
        const answer = challenge.answers.find((candidate) => candidate.id === zone.id);
        if (!answer) return null;
        const available = isAnswerAvailable(run, zone.id);
        return (
          <path
            key={zone.id}
            d={zone.path}
            fillRule="evenodd"
            vectorEffect="non-scaling-stroke"
            className="game-zone"
            data-state={answerStateOf(run, challenge, zone.id)}
            data-available={available}
            role="button"
            tabIndex={available ? 0 : -1}
            aria-label={tContent(answer.labelKey)}
            aria-disabled={!available}
            onClick={() => onAnswer(zone.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onAnswer(zone.id);
            }}
          />
        );
      })}
    </svg>
  );
}
