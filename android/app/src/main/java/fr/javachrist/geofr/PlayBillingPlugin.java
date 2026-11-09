package fr.javachrist.geofr;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.android.billingclient.api.AccountIdentifiers;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONException;

/**
 * Google Play Billing (achats uniques, produits « inapp »). Le plugin lit les prix localisés, lance l'achat
 * et liste les achats de l'appareil. Il ne valide rien et n'accuse jamais réception : le serveur vérifie
 * chaque jeton auprès de l'API Google Play Developer, accorde les droits puis accuse réception
 * (sans accusé sous 3 jours, Google rembourse). Voir docs/paiements.md, section Google Play.
 */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    @Nullable private PluginCall purchaseCall;
    @Nullable private String purchaseProductId;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) client.endConnection();
    }

    private void whenReady(PluginCall call, Runnable action) {
        if (client.isReady()) {
            action.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) action.run();
                else rejectWith(call, result);
            }

            @Override
            public void onBillingServiceDisconnected() {}
        });
    }

    private void rejectWith(PluginCall call, BillingResult result) {
        if (call == purchaseCall) {
            purchaseCall = null;
            purchaseProductId = null;
        }
        call.reject("Google Play Billing : " + result.getDebugMessage(), "billing_" + result.getResponseCode());
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        JSArray ids = call.getArray("productIds");
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        try {
            for (String id : ids.<String>toList()) {
                products.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build());
            }
        } catch (JSONException | NullPointerException error) {
            call.reject("productIds invalides", "invalidRequest");
            return;
        }
        if (products.isEmpty()) {
            call.reject("productIds vide", "invalidRequest");
            return;
        }
        whenReady(call, () -> client.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(products).build(),
            (result, query) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectWith(call, result);
                    return;
                }
                JSArray list = new JSArray();
                for (ProductDetails product : query.getProductDetailsList()) {
                    ProductDetails.OneTimePurchaseOfferDetails offer = product.getOneTimePurchaseOfferDetails();
                    if (offer == null) continue;
                    details.put(product.getProductId(), product);
                    JSObject item = new JSObject();
                    item.put("productId", product.getProductId());
                    item.put("formattedPrice", offer.getFormattedPrice());
                    item.put("priceMicros", offer.getPriceAmountMicros());
                    item.put("currency", offer.getPriceCurrencyCode());
                    list.put(item);
                }
                JSObject response = new JSObject();
                response.put("products", list);
                call.resolve(response);
            }
        ));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        String accountId = call.getString("obfuscatedAccountId");
        String profileId = call.getString("obfuscatedProfileId");
        ProductDetails product = productId == null ? null : details.get(productId);
        if (product == null || accountId == null || profileId == null) {
            call.reject("Produit inconnu ou identifiants manquants", "invalidRequest");
            return;
        }
        if (purchaseCall != null) {
            call.reject("Un achat est déjà en cours", "busy");
            return;
        }
        BillingFlowParams params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(
                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).build()))
            // Liens vers le compte et la commande, relus par le serveur : un achat ne sert jamais un autre compte.
            .setObfuscatedAccountId(accountId)
            .setObfuscatedProfileId(profileId)
            .build();
        purchaseCall = call;
        purchaseProductId = productId;
        whenReady(call, () -> getActivity().runOnUiThread(() -> {
            BillingResult result = client.launchBillingFlow(getActivity(), params);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                onPurchasesUpdated(result, null);
            }
        }));
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, @Nullable List<Purchase> purchases) {
        PluginCall call = purchaseCall;
        String productId = purchaseProductId;
        purchaseCall = null;
        purchaseProductId = null;
        int code = result.getResponseCode();
        JSObject matched = null;
        if (purchases != null) {
            for (Purchase purchase : purchases) {
                JSObject item = toJs(purchase);
                // Achat arrivé après coup (paiement en attente devenu payé, achat hors de l'application) :
                // signalé à l'interface, qui le fait vérifier par le serveur.
                notifyListeners("purchaseUpdated", item);
                if (productId != null && purchase.getProducts().contains(productId)) matched = item;
            }
        }
        if (call == null) return;
        JSObject response = new JSObject();
        if (code == BillingClient.BillingResponseCode.OK && matched != null) {
            response.put("status", "PURCHASED".equals(matched.getString("state")) ? "purchased" : "pending");
            response.put("purchase", matched);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            response.put("status", "canceled");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            response.put("status", "alreadyOwned");
        } else {
            response.put("status", "error");
            response.put("code", code);
        }
        call.resolve(response);
    }

    @PluginMethod
    public void queryPurchases(PluginCall call) {
        whenReady(call, () -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    rejectWith(call, result);
                    return;
                }
                JSArray list = new JSArray();
                for (Purchase purchase : purchases) list.put(toJs(purchase));
                JSObject response = new JSObject();
                response.put("purchases", list);
                call.resolve(response);
            }
        ));
    }

    private static JSObject toJs(Purchase purchase) {
        JSObject item = new JSObject();
        item.put("purchaseToken", purchase.getPurchaseToken());
        item.put("productIds", new JSArray(purchase.getProducts()));
        item.put("orderId", purchase.getOrderId());
        item.put("acknowledged", purchase.isAcknowledged());
        int state = purchase.getPurchaseState();
        item.put("state", state == Purchase.PurchaseState.PURCHASED ? "PURCHASED"
            : state == Purchase.PurchaseState.PENDING ? "PENDING" : "UNSPECIFIED");
        AccountIdentifiers ids = purchase.getAccountIdentifiers();
        item.put("obfuscatedAccountId", ids == null ? null : ids.getObfuscatedAccountId());
        item.put("obfuscatedProfileId", ids == null ? null : ids.getObfuscatedProfileId());
        return item;
    }
}
