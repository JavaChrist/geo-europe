import { Award, Lock } from "lucide-react";
import Image from "next/image";
import content from "@country";
import type { RewardBadge } from "@/engine/types";

/** Illustration déclarée par le territoire, sinon l'icône commune. Un badge à gagner reste masqué. */
export function BadgeEmblem({ badge, earned }: { badge: RewardBadge; earned: boolean }) {
  const credit = earned && badge.mediaId ? content.credits.find((candidate) => candidate.id === badge.mediaId) : undefined;
  if (credit) {
    return (
      <span className="relative block size-12 shrink-0 overflow-hidden rounded-full border border-gold/60">
        <Image src={credit.file} alt="" fill sizes="48px" className="object-cover" />
      </span>
    );
  }
  const Icon = earned ? Award : Lock;
  return <Icon aria-hidden className={`mt-0.5 size-6 shrink-0 ${earned ? "text-gold" : "text-ink-soft"}`} />;
}
