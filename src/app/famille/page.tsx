import { UsersRound } from "lucide-react";
import { getTranslator } from "@/i18n/translator";
import { ComingSoon } from "@/ui/ComingSoon";

export default function FamilyPage() {
  const { t } = getTranslator();
  return (
    <ComingSoon
      icon={UsersRound}
      title={t("soon.family.title")}
      body={t("soon.family.body")}
      badge={t("common.comingSoon")}
      backHref="/"
      backLabel={t("common.backHome")}
    />
  );
}
