// Généré au build : chaque déploiement publie ainsi son propre identifiant.
export const dynamic = "force-static";

export function GET() {
  return Response.json({ buildId: process.env.NEXT_PUBLIC_BUILD_ID });
}
