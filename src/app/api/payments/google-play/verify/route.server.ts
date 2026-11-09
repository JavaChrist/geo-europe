import { appPreflight, errorResponse, noStore, readJson, withAppCors } from "@/services/payments/http";
import { applyPlayPurchase, PaymentRequestError, verifyBuyer } from "@/services/payments/orders";

// Vérifie un jeton d'achat Google Play présenté par l'application (achat, achat en attente devenu payé, restauration).
// Le serveur relit l'achat auprès de Google ; le compte qui présente le jeton doit être celui de la commande.
export const dynamic = "force-dynamic";

export const POST = withAppCors(async (request: Request) => {
  try {
    const buyer = await verifyBuyer(request, { requireVerified: true });
    const body = await readJson(request);
    if (typeof body.productId !== "string" || typeof body.purchaseToken !== "string") {
      throw new PaymentRequestError(400, "invalidRequest");
    }
    const outcome = await applyPlayPurchase(body.productId, body.purchaseToken, buyer.uid);
    if ("unattached" in outcome) throw new PaymentRequestError(404, "notFound");
    if (outcome.mismatch) throw new PaymentRequestError(409, "purchaseRejected");
    return Response.json({ id: outcome.id, editionId: outcome.editionId, status: outcome.status }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, "google-play-verify");
  }
});

export const OPTIONS = appPreflight;
