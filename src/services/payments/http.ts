import { ServerConfigError } from "@/services/firebase/admin";
import { PaymentRequestError } from "./orders";

/**
 * Réponses des routes de paiement : un code lisible par l'interface, jamais de détail technique.
 * Les erreurs inattendues sont journalisées côté serveur uniquement.
 */
export function errorResponse(error: unknown, route: string): Response {
  if (error instanceof PaymentRequestError) return Response.json({ error: error.code }, { status: error.status });
  if (error instanceof ServerConfigError) {
    console.error(`[${route}] ${error.message}`);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  console.error(`[${route}]`, error);
  return Response.json({ error: "unknown" }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // Corps absent ou illisible : traité comme une requête invalide.
  }
  throw new PaymentRequestError(400, "invalidRequest");
}

export const noStore = { "Cache-Control": "no-store" };
