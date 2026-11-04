import { UserRound } from "lucide-react";
import { getTranslator } from "@/i18n/translator";
import { ComingSoon } from "@/ui/ComingSoon";

export default function ProfilePage() {
  const { t } = getTranslator();
  return (
    <ComingSoon
      icon={UserRound}
      title={t("soon.profile.title")}
      body={t("soon.profile.body")}
      badge={t("common.comingSoon")}
      backHref="/"
      backLabel={t("common.backHome")}
    />
  );
}
