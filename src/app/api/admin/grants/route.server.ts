import {
  addGrant,
  listGrants,
  revokeGrant,
  verifyAdmin,
} from "@/services/grants";
import { errorResponse, noStore, readJson } from "@/services/payments/http";
import { PaymentRequestError } from "@/services/payments/orders";

// Administration des accès offerts : liste, ajout, révocation. Réservée aux comptes cités dans `admins/{uid}`.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (body.action === "status") {
      // Sert seulement à afficher le lien du Profil : la page et chaque action revérifient l'administrateur.
      // Un compte non administrateur reçoit `false` en 200, pour ne pas laisser un 403 dans la console de chaque joueur.
      try {
        await verifyAdmin(request);
        return Response.json({ admin: true }, { headers: noStore });
      } catch (error) {
        if (error instanceof PaymentRequestError && error.status === 403)
          return Response.json({ admin: false }, { headers: noStore });
        throw error;
      }
    }
    const admin = await verifyAdmin(request);
    switch (body.action) {
      case "list":
        return Response.json(
          { grants: await listGrants() },
          { headers: noStore },
        );
      case "add":
        return Response.json(
          { grant: await addGrant(admin, body.email) },
          { headers: noStore },
        );
      case "revoke":
        return Response.json(
          { grant: await revokeGrant(admin, body.email) },
          { headers: noStore },
        );
      default:
        throw new PaymentRequestError(400, "invalidRequest");
    }
  } catch (error) {
    return errorResponse(error, "admin-grants");
  }
}
