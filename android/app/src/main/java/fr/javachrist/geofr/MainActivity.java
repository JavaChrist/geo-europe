package fr.javachrist.geofr;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins locaux de l'application (connexion Google et Google Play Billing), avant le démarrage du pont.
        registerPlugin(GoogleSignInPlugin.class);
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);

        // Bouton retour d'Android. Pendant une partie, la page ouvre la modale « Quitter le quiz ? » et rien d'autre
        // ne se passe (voir src/ui/nav/leave-guard.tsx). Sinon il remonte l'historique de la WebView, comme un navigateur,
        // et sans historique l'application se comporte comme avant (retour à l'écran d'accueil d'Android).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    systemBack(this);
                    return;
                }
                webView.evaluateJavascript(ASK_PAGE, (handled) -> {
                    if ("true".equals(handled)) return;
                    if (webView.canGoBack()) webView.goBack();
                    else systemBack(this);
                });
            }
        });
    }

    /** Rend `true` quand la page a pris le retour en charge (partie en cours). */
    private static final String ASK_PAGE = "(function(){var f=window.__geoNativeBack;return typeof f==='function'&&f()===true;})()";

    private void systemBack(OnBackPressedCallback callback) {
        callback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        callback.setEnabled(true);
    }
}
