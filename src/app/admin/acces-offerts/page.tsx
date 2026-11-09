import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { paymentChannel } from "@/services/api";
import { OfferedAccessAdmin } from "@/features/admin/OfferedAccessAdmin";

// Administration des accès offerts. Site web uniquement : dans l'application Android (export statique), la page n'existe pas.
// Aucun menu n'y mène ; le serveur vérifie l'administrateur à chaque appel.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OfferedAccessPage() {
  if (paymentChannel() !== "web") notFound();
  return <OfferedAccessAdmin />;
}
