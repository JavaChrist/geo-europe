import { errorResponse, readJson } from "@/services/payments/http";
import { decodePlayNotification, verifyPubSubRequest } from "@/services/payments/google-play";
import { handlePlayNotification } from "@/services/payments/orders";

// Notifications développeur en temps réel de Google Play, reçues par un abonnement Pub/Sub en mode push.
// Chaque requête porte un jeton OIDC signé par Google, vérifié avant toute lecture. Le contenu n'est qu'un signal :
// l'achat est toujours relu auprès de l'API Google Play Developer.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!(await verifyPubSubRequest(request))) return new Response(null, { status: 401 });
    const notification = decodePlayNotification(await readJson(request));
    // Message illisible : accusé quand même, sans quoi Pub/Sub le renverrait sans fin.
    if (notification) await handlePlayNotification(notification);
    return new Response(null, { status: 204 });
  } catch (error) {
    // Réponse en erreur : Pub/Sub renvoie la notification plus tard.
    return errorResponse(error, "google-play-notify");
  }
}
