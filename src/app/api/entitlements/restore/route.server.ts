import { errorResponse, noStore } from "@/services/payments/http";
import { restoreEntitlements, verifyBuyer } from "@/services/payments/orders";

// Recalcule les droits du joueur connecté à partir de ses commandes vérifiées, par exemple sur un nouvel appareil.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const buyer = await verifyBuyer(request, { requireVerified: false });
    return Response.json(await restoreEntitlements(buyer), { headers: noStore });
  } catch (error) {
    return errorResponse(error, "restore");
  }
}
