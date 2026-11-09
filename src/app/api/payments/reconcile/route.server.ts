import { timingSafeEqual } from "node:crypto";
import { errorResponse, noStore } from "@/services/payments/http";
import { reconcileOrders } from "@/services/payments/orders";
import { retryWithdrawalAcknowledgements } from "@/services/withdrawal";

// Rattrapage des notifications perdues et des accusés de rétractation non partis, à appeler par une tâche planifiée (Vercel Cron envoie « Bearer CRON_SECRET »).
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
    const orders = await reconcileOrders();
    const withdrawals = await retryWithdrawalAcknowledgements();
    return Response.json({ ...orders, withdrawals }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, "reconcile");
  }
}
