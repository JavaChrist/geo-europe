import { applyPaymentById } from "@/services/payments/orders";

// Notification Mollie : elle ne contient que l'identifiant du paiement. L'état officiel est toujours relu chez Mollie.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let id = "";
  try {
    id = String((await request.formData()).get("id") ?? "");
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    const outcome = await applyPaymentById(id);
    // Paiement inconnu : réponse 200 pour ne rien révéler, sans aucun effet.
    if (outcome?.mismatch) console.error(`[webhook] paiement ${id} refusé : ${outcome.mismatch}`);
    return new Response(null, { status: 200 });
  } catch (error) {
    // Erreur passagère : Mollie renverra la notification plus tard.
    console.error("[webhook]", error);
    return new Response(null, { status: 500 });
  }
}
