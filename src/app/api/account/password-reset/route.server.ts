import { sendPasswordResetMail } from "@/services/mail/account-mail";
import { appPreflight, errorResponse, noStore, readJson, withAppCors } from "@/services/payments/http";

// Réinitialisation du mot de passe, sans compte connecté. La réponse ne dit jamais si l'adresse existe.
export const dynamic = "force-dynamic";

export const POST = withAppCors(async (request: Request) => {
  try {
    const { email } = await readJson(request);
    await sendPasswordResetMail(typeof email === "string" ? email : "");
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, "password-reset");
  }
});

export const OPTIONS = appPreflight;
