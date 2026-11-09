import { sendVerificationMail } from "@/services/mail/account-mail";
import { appPreflight, errorResponse, noStore, withAppCors } from "@/services/payments/http";
import { verifyBuyer } from "@/services/payments/orders";

// Lien de vérification de l'adresse du compte connecté, envoyé avec le modèle du Mail-Kit.
export const dynamic = "force-dynamic";

export const POST = withAppCors(async (request: Request) => {
  try {
    const buyer = await verifyBuyer(request, { requireVerified: false });
    return Response.json(await sendVerificationMail(buyer), { headers: noStore });
  } catch (error) {
    return errorResponse(error, "verification");
  }
});

export const OPTIONS = appPreflight;
