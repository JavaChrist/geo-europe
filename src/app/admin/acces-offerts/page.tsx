import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfferedAccessAdmin } from "@/features/admin/OfferedAccessAdmin";

// Administration des accès offerts. Sans serveur (export Android, `NEXT_PUBLIC_PAYMENTS=off`), la page n'existe pas.
// Aucun menu n'y mène ; le serveur vérifie l'administrateur à chaque appel.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OfferedAccessPage() {
  if (process.env.NEXT_PUBLIC_PAYMENTS === "off") notFound();
  return <OfferedAccessAdmin />;
}
