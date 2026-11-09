/**
 * Adresse des routes serveur et canal de paiement, fixés au build par `next.config.ts`.
 *
 * - `web` : site Next.js déployé, routes relatives, achats par Mollie.
 * - `play` : application Android (export statique). Les routes sont appelées sur le serveur HTTPS déployé
 *   (`NEXT_PUBLIC_API_BASE_URL`), et les achats passent par Google Play Billing. Jamais Mollie.
 * - `off` : export sans serveur configuré. Jeu gratuit seulement, ni compte ni achat.
 */
export type PaymentChannel = "web" | "play" | "off";

export function paymentChannel(): PaymentChannel {
  const value = process.env.NEXT_PUBLIC_PAYMENTS;
  return value === "web" || value === "play" ? value : "off";
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** `/api/...` sur le web, `https://<serveur>/api/...` dans l'application. */
export const apiUrl = (path: string): string => `${API_BASE}${path}`;
