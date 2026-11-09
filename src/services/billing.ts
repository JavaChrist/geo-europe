import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { EditionId } from "@/engine/types";
import {
  requestPlayPreparation,
  requestPlayVerification,
  type CheckoutConsent,
  type OrderState,
} from "./account";
import { AppError, toAppError } from "./app-error";

/**
 * Google Play Billing dans l'application Android (plugin local `PlayBilling`, voir PlayBillingPlugin.java).
 * L'application n'accorde jamais un droit : chaque jeton d'achat est envoyé au serveur, qui le relit auprès de
 * Google, écrit les droits puis accuse réception. Voir docs/paiements.md, section Google Play.
 */
export interface PlayPurchase {
  purchaseToken: string;
  productIds: string[];
  orderId: string | null;
  acknowledged: boolean;
  state: "PURCHASED" | "PENDING" | "UNSPECIFIED";
  obfuscatedAccountId: string | null;
  obfuscatedProfileId: string | null;
}

interface PlayBillingPlugin {
  getProducts(options: { productIds: string[] }): Promise<{
    products: { productId: string; formattedPrice: string; priceMicros: number; currency: string }[];
  }>;
  purchase(options: { productId: string; obfuscatedAccountId: string; obfuscatedProfileId: string }): Promise<{
    status: "purchased" | "pending" | "canceled" | "alreadyOwned" | "error";
    purchase?: PlayPurchase;
    code?: number;
  }>;
  queryPurchases(): Promise<{ purchases: PlayPurchase[] }>;
  addListener(event: "purchaseUpdated", listener: (purchase: PlayPurchase) => void): Promise<PluginListenerHandle>;
}

const PlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");

export const playBillingAvailable = (): boolean =>
  Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("PlayBilling");

/** Prix localisés de la Play Console, par identifiant de produit. Vide hors de l'application ou sans réseau. */
export async function playPrices(productIds: string[]): Promise<Record<string, string>> {
  if (!playBillingAvailable() || productIds.length === 0) return {};
  try {
    const { products } = await PlayBilling.getProducts({ productIds });
    return Object.fromEntries(products.map((product) => [product.productId, product.formattedPrice]));
  } catch {
    return {};
  }
}

export type PlayPurchaseResult =
  | { kind: "verified"; order: OrderState }
  | { kind: "canceled" }
  | { kind: "restored"; count: number };

/**
 * Achat d'une édition : le serveur prépare la commande (contrôles, consentements, références), Google encaisse,
 * puis le serveur vérifie le jeton. Un paiement différé revient `pending` ; Google prévient le serveur à son issue.
 */
export async function buyOnPlay(editionId: EditionId, consent: CheckoutConsent): Promise<PlayPurchaseResult> {
  if (!playBillingAvailable()) throw new AppError("paymentsUnavailable");
  const preparation = await requestPlayPreparation(editionId, consent);
  // Le plugin n'achète qu'un produit dont il a lu la fiche : relecture systématique, le prix a pu changer.
  const prices = await playPrices([preparation.productId]);
  if (!prices[preparation.productId]) throw new AppError("paymentsUnavailable");
  let result: Awaited<ReturnType<PlayBillingPlugin["purchase"]>>;
  try {
    result = await PlayBilling.purchase({
      productId: preparation.productId,
      obfuscatedAccountId: preparation.obfuscatedAccountId,
      obfuscatedProfileId: preparation.obfuscatedProfileId,
    });
  } catch (cause) {
    throw new AppError("paymentFailed", { cause });
  }
  if (result.status === "canceled") return { kind: "canceled" };
  if (result.status === "alreadyOwned") return { kind: "restored", count: await restorePlayPurchases() };
  if (result.status === "error" || !result.purchase) throw new AppError("paymentFailed");
  return {
    kind: "verified",
    order: await requestPlayVerification(preparation.productId, result.purchase.purchaseToken),
  };
}

/**
 * Restauration : chaque achat Google Play de l'appareil est revérifié par le serveur. Un achat d'un autre compte
 * est refusé par le serveur (`purchaseOtherAccount`) ; un achat sans commande est ignoré.
 * Renvoie le nombre d'achats rattachés à ce compte.
 */
export async function restorePlayPurchases(): Promise<number> {
  if (!playBillingAvailable()) throw new AppError("paymentsUnavailable");
  let purchases: PlayPurchase[];
  try {
    ({ purchases } = await PlayBilling.queryPurchases());
  } catch (cause) {
    throw new AppError("paymentsUnavailable", { cause });
  }
  let count = 0;
  let otherAccount: AppError | null = null;
  for (const purchase of purchases) {
    const productId = purchase.productIds[0];
    if (!productId || purchase.state === "UNSPECIFIED") continue;
    try {
      await requestPlayVerification(productId, purchase.purchaseToken);
      count += 1;
    } catch (error) {
      const appError = toAppError(error);
      if (appError.code === "orderNotFound") continue;
      if (appError.code === "purchaseOtherAccount") {
        otherAccount = appError;
        continue;
      }
      throw appError;
    }
  }
  if (count === 0 && otherAccount) throw otherAccount;
  return count;
}

/**
 * Achats arrivés hors de l'écran d'achat (paiement différé devenu payé, achat relancé par Google Play) :
 * vérifiés par le serveur dès qu'ils sont signalés. Les échecs sont rattrapés par la restauration et la tâche quotidienne.
 */
export function watchPlayPurchases(): () => void {
  if (!playBillingAvailable()) return () => undefined;
  let handle: PluginListenerHandle | null = null;
  let stopped = false;
  void PlayBilling.addListener("purchaseUpdated", (purchase) => {
    const productId = purchase.productIds[0];
    if (!productId || purchase.state !== "PURCHASED") return;
    void requestPlayVerification(productId, purchase.purchaseToken).catch(() => undefined);
  }).then((listener) => {
    if (stopped) void listener.remove();
    else handle = listener;
  });
  return () => {
    stopped = true;
    void handle?.remove();
  };
}
