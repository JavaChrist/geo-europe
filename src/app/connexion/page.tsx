import { Suspense } from "react";
import { SignIn } from "@/features/account/SignIn";

// Composant client qui lit l'adresse : Suspense est requis pour le rendu statique.
export default function ConnexionPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
