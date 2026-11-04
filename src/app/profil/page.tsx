import { UserRound } from "lucide-react";
import Link from "next/link";
import content from "@country";
import { summarizeLevel } from "@/engine/level-unlock";
import { NationalProgress } from "@/features/journey/ProgressPanels";
import { getTranslator } from "@/i18n/translator";
import { ComingSoon } from "@/ui/ComingSoon";

export default function ProfilePage() {
  const { t } = getTranslator();
  const territories = content.territories.map((territory) => ({ id: territory.id, levels: territory.levels.map(summarizeLevel) }));
  return (
    <ComingSoon
      icon={UserRound}
      title={t("soon.profile.title")}
      body={t("soon.profile.body")}
      badge={t("common.comingSoon")}
      backHref="/"
      backLabel={t("common.backHome")}
      extra={
        <Link
          href="/profil/confidentialite"
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-ink-soft underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
        >
          {t("privacy.title")}
        </Link>
      }
    >
      <NationalProgress territories={territories} />
    </ComingSoon>
  );
}
