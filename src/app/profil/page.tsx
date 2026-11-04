import { UserRound } from "lucide-react";
import Link from "next/link";
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
      extra={
        <Link
          href="/profil/sources"
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-ink-soft underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
        >
          {t("sources.title")}
        </Link>
      }
    />
  );
}
