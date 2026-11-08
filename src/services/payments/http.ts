import { ServerConfigError, ServiceUnavailableError } from "@/services/firebase/admin";
import { logServerError } from "@/services/server-log";
import { PaymentRequestError } from "./orders";

/**
 * Réponses des routes de paiement et de compte : un code lisible par l'interface, jamais de détail technique.
 * Les erreurs du serveur sont journalisées côté serveur uniquement, sans l'objet d'origine (ni en-têtes, ni jeton, ni clé).
 */
export function errorResponse(error: unknown, route: string): Response {
  if (error instanceof PaymentRequestError) return Response.json({ error: error.code }, { status: error.status });
  if (error instanceof ServerConfigError || error instanceof ServiceUnavailableError) {
    logServerError(route, error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  logServerError(route, error);
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
