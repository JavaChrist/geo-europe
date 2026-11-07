import { Suspense } from "react";
import { PaymentReturn } from "@/features/shop/PaymentReturn";

// Composant client qui lit l'adresse : Suspense est requis pour le rendu statique.
export default function PaymentReturnPage() {
  return (
    <Suspense>
      <PaymentReturn />
    </Suspense>
  );
}
