// Exemple de route serveur : absente du build Android grâce à l'extension .server.ts.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
