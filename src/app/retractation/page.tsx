import type { Metadata } from "next";
import content from "@country";
import { WithdrawalForm } from "@/features/withdrawal/WithdrawalForm";
import { getTranslator } from "@/i18n/translator";

// Fonction de rétractation en ligne : publique, sans connexion, citée par les conditions de vente (Legal Kit
// `withdrawalAction`). Dans l'export Android, le formulaire laisse place à la demande par email.
export function generateMetadata(): Metadata {
  const { t } = getTranslator();
  return { title: `${t("withdrawal.title")} — ${content.country.appName}` };
}

export default function WithdrawalPage() {
  return <WithdrawalForm />;
}
