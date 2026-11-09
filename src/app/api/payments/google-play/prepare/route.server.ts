import { appPreflight, errorResponse, noStore, readJson, withAppCors } from "@/services/payments/http";
import { PaymentRequestError, preparePlayOrder, verifyBuyer } from "@/services/payments/orders";

// Prépare un achat Google Play : commande, produit et références à transmettre à Google. Ne donne jamais un droit.
export const dynamic = "force-dynamic";

export const POST = withAppCors(async (request: Request) => {
  try {
    const buyer = await verifyBuyer(request, { requireVerified: true });
    const body = await readJson(request);
    const consent = body.consent as Record<string, unknown> | undefined;
    if (typeof body.editionId !== "string" || typeof consent !== "object" || consent === null) {
      throw new PaymentRequestError(400, "invalidRequest");
    }
    const result = await preparePlayOrder(buyer, body.editionId, {
      termsAccepted: consent.termsAccepted === true,
      immediateAccessRequested: consent.immediateAccessRequested === true,
      withdrawalWaiverAccepted: consent.withdrawalWaiverAccepted === true,
    });
    return Response.json(result, { headers: noStore });
  } catch (error) {
    return errorResponse(error, "google-play-prepare");
  }
});

export const OPTIONS = appPreflight;
