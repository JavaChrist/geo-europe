import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { paymentChannel } from "@/services/api";
import { WithdrawalAdmin } from "@/features/admin/WithdrawalAdmin";

// Administration des rétractations. Site web uniquement : dans l'application Android (export statique), la page n'existe pas.
// Le lien n'apparaît dans le Profil que pour un administrateur ; le serveur le revérifie à chaque appel.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function WithdrawalAdminPage() {
  if (paymentChannel() !== "web") notFound();
  return <WithdrawalAdmin />;
}
