import { errorResponse, noStore, readJson } from "@/services/payments/http";
import { PaymentRequestError, syncOrder, verifyBuyer } from "@/services/payments/orders";

// Relit l'état d'une commande du joueur connecté chez Mollie. Utilisée par la page de retour, sans jamais se fier à l'adresse.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const buyer = await verifyBuyer(request, { requireVerified: false });
    const body = await readJson(request);
    if (typeof body.orderId !== "string") throw new PaymentRequestError(400, "invalidRequest");
    return Response.json(await syncOrder(buyer, body.orderId), { headers: noStore });
  } catch (error) {
    return errorResponse(error, "sync");
  }
}
