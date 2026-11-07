import { errorResponse, noStore, readJson } from "@/services/payments/http";
import { PaymentRequestError, startCheckout, verifyBuyer } from "@/services/payments/orders";

// Prépare un paiement. Renvoie uniquement l'adresse de paiement Mollie, jamais un droit.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const buyer = await verifyBuyer(request, { requireVerified: true });
    const body = await readJson(request);
    const consent = body.consent as Record<string, unknown> | undefined;
    if (typeof body.editionId !== "string" || typeof consent !== "object" || consent === null) {
      throw new PaymentRequestError(400, "invalidRequest");
    }
    const result = await startCheckout(buyer, body.editionId, {
      termsAccepted: consent.termsAccepted === true,
      immediateAccessRequested: consent.immediateAccessRequested === true,
      withdrawalWaiverAccepted: consent.withdrawalWaiverAccepted === true,
    });
    return Response.json(result, { headers: noStore });
  } catch (error) {
    return errorResponse(error, "checkout");
  }
}
