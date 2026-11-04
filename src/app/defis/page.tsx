import { Swords } from "lucide-react";
import { getTranslator } from "@/i18n/translator";
import { ComingSoon } from "@/ui/ComingSoon";

export default function ChallengesPage() {
  const { t } = getTranslator();
  return (
    <ComingSoon
      icon={Swords}
      title={t("soon.challenges.title")}
      body={t("soon.challenges.body")}
      badge={t("common.comingSoon")}
      backHref="/"
      backLabel={t("common.backHome")}
    />
  );
}
