import type { Metadata } from "next";
import { AuthLink } from "@/features/account/AuthLink";

// Le lien contient un code à usage unique : aucune adresse de provenance n'est transmise, et la page n'est pas indexée.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function LienPage() {
  return <AuthLink />;
}
