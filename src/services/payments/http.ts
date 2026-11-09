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

// --- Application Android ------------------------------------------------------------------------------------------

/**
 * Origines de l'application Capacitor (export statique servi depuis l'appareil), seules autorisées à appeler
 * ces routes depuis un autre domaine. `APP_CORS_ORIGINS` (liste séparée par des virgules) en ajoute pour un test.
 * Aucun cookie n'est échangé : le compte est prouvé par le jeton Firebase de l'en-tête `Authorization`.
 * Le paiement Mollie n'est pas ouvert à l'application : sa route n'utilise pas `withAppCors`.
 */
const APP_ORIGINS = ["https://localhost", "capacitor://localhost"];

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const extra = (process.env.APP_CORS_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...APP_ORIGINS, ...extra].includes(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Ajoute les en-têtes CORS de l'application à la réponse d'une route POST. */
export function withAppCors(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const response = await handler(request);
    const origin = allowedOrigin(request);
    if (!origin) return response;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(corsHeaders(origin))) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}

/** Réponse à la requête préalable (`OPTIONS`) du navigateur de l'application. */
export function appPreflight(request: Request): Response {
  const origin = allowedOrigin(request);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
