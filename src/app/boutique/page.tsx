import { Suspense } from "react";
import { Shop } from "@/features/shop/Shop";

// Composant client qui lit l'adresse : Suspense est requis pour le rendu statique.
export default function BoutiquePage() {
  return (
    <Suspense>
      <Shop />
    </Suspense>
  );
}
