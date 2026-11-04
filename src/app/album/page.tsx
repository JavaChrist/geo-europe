import { BookOpen } from "lucide-react";
import { getTranslator } from "@/i18n/translator";
import { ComingSoon } from "@/ui/ComingSoon";

export default function AlbumPage() {
  const { t } = getTranslator();
  return (
    <ComingSoon
      icon={BookOpen}
      title={t("soon.album.title")}
      body={t("soon.album.body")}
      badge={t("common.comingSoon")}
      backHref="/"
      backLabel={t("common.backHome")}
    />
  );
}
