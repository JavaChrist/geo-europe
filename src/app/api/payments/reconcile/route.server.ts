import { timingSafeEqual } from "node:crypto";
import { errorResponse, noStore } from "@/services/payments/http";
import { reconcileOrders } from "@/services/payments/orders";

// Rattrapage des notifications perdues, à appeler par une tâche planifiée (Vercel Cron envoie « Bearer CRON_SECRET »).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  try {
    return Response.json(await reconcileOrders(), { headers: noStore });
  } catch (error) {
    return errorResponse(error, "reconcile");
  }
}
