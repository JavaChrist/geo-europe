export const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;
export const UPDATE_CHECK_ENABLED = process.env.NEXT_PUBLIC_UPDATE_CHECK === "on";

/** Identifiant de la version en ligne, ou `null` si elle est injoignable : le joueur n'a pas à le savoir. */
export async function fetchLatestBuildId(): Promise<string | null> {
  try {
    const response = await fetch("/version.json", { cache: "no-store" });
    if (!response.ok) return null;
    const { buildId } = (await response.json()) as { buildId?: unknown };
    return typeof buildId === "string" ? buildId : null;
  } catch {
    return null;
  }
}
