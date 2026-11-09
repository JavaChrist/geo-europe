import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WithdrawalAdmin } from "@/features/admin/WithdrawalAdmin";

// Administration des rétractations. Sans serveur (export Android, `NEXT_PUBLIC_PAYMENTS=off`), la page n'existe pas.
// Le lien n'apparaît dans le Profil que pour un administrateur ; le serveur le revérifie à chaque appel.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function WithdrawalAdminPage() {
  if (process.env.NEXT_PUBLIC_PAYMENTS === "off") notFound();
  return <WithdrawalAdmin />;
}
