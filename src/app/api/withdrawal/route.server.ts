import { errorResponse, noStore, readJson } from "@/services/payments/http";
import { submitWithdrawal } from "@/services/withdrawal";

// Fonction de rétractation en ligne : publique, sans connexion. La réponse ne dit jamais si une commande a été trouvée.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return Response.json(await submitWithdrawal(request, body), { headers: noStore });
  } catch (error) {
    return errorResponse(error, "withdrawal");
  }
}
