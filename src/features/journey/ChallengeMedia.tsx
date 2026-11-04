"use client";

import Image from "next/image";
import content from "@country";
import { answerStateOf, isAnswerAvailable, type LevelRun } from "@/engine/level-run";
import type { MapChallenge, VisualChallenge } from "@/engine/types";
import { useTranslation } from "@/i18n/I18nProvider";
import { PhotoCredit } from "@/ui/PhotoCredit";

/** Photo d'un défi, toujours accompagnée de son crédit. */
export function ChallengePhoto({ challenge }: { challenge: VisualChallenge }) {
  const { tContent } = useTranslation();
  const credit = content.credits.find((candidate) => candidate.id === challenge.mediaId);
  if (!credit?.width || !credit.height) return null;

  return (
    <figure className="flex flex-col gap-1.5">
      {/* La place est réservée avant le chargement et plafonnée selon l'écran : la photo n'est jamais recadrée. */}
      <div
        className="relative max-h-[34dvh] w-full overflow-hidden rounded-2xl border border-gold/20 bg-abyss/60 sm:max-h-96"
        style={{ aspectRatio: credit.width / credit.height }}
      >
        <Image
          src={credit.file}
          alt={credit.altKey ? tContent(credit.altKey) : ""}
          fill
          sizes="(min-width: 672px) 640px, 100vw"
          className="object-contain"
        />
      </div>
      <PhotoCredit credit={credit} />
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
