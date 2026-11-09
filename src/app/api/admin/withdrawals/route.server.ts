import { verifyAdmin } from "@/services/grants";
import { errorResponse, noStore, readJson } from "@/services/payments/http";
import { PaymentRequestError } from "@/services/payments/orders";
import { decideWithdrawal, listWithdrawals } from "@/services/withdrawal";

// Administration des rétractations : liste et décision. Aucun remboursement ni retrait de droits ici.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    const body = await readJson(request);
    switch (body.action) {
      case "list":
        return Response.json({ withdrawals: await listWithdrawals() }, { headers: noStore });
      case "decide":
        return Response.json(
          { withdrawal: await decideWithdrawal(admin, body.id, body.decision, body.note) },
          { headers: noStore },
        );
      default:
        throw new PaymentRequestError(400, "invalidRequest");
    }
  } catch (error) {
    return errorResponse(error, "admin-withdrawals");
  }
}
