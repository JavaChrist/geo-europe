"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import content from "@country";
import { adAudience, adsAllowed, ADS_RULES, mayRequestBanner, requestSettingsFor, type AdAudience } from "@/engine/ads";
import { useEntitlements } from "@/features/account/EntitlementsProvider";
import {
  applyRequestSettings,
  gatherConsent,
  hideBanner,
  isNativeApp,
  listenBanner,
  removeBanner,
  resumeBanner,
  showBanner,
  showPrivacyOptions,
  type ConsentState,
} from "@/services/ads/admob";
import { onAdultAnswerChange, readPromoState } from "@/services/promotions";
import { useModalBusy } from "@/ui/modal/ModalProvider";

/**
 * Bannière AdMob de l'application Android (voir `docs/admob.md`).
 *
 * La bannière est une vue native posée au-dessus de la WebView : elle ne doit jamais couvrir le jeu.
 * Elle se place juste au-dessus de la barre de navigation, la page réserve sa hauteur (`--ad-banner-h`),
 * et elle est masquée pendant une partie, une modale, la question d'âge ou une vidéo de promotion.
 *
 * Aucune requête sans droit à la publicité (édition sans publicités, accès offert, droits en chargement),
 * ni sur le web. Toutes les opérations natives passent l'une après l'autre par `reconcile`.
 */

/** Option de build réservée aux tests : elle ne peut que retirer les annonces, jamais ouvrir un droit. */
const FORCE_NO_ADS = process.env.NEXT_PUBLIC_ADS_TEST_NO_ADS === "1";
const BANNER_HEIGHT_VAR = "--ad-banner-h";

interface AdsApi {
  /** Masque la bannière tant que la fonction rendue n'est pas appelée. */
  hide: () => () => void;
  /** Consentement UMP d'un adulte, `null` tant qu'il n'a pas été demandé. */
  consent: ConsentState | null;
  /** Rouvre le formulaire « Choix publicitaires » de Google. */
  openPrivacyOptions: () => Promise<void>;
  /**
   * Retire la bannière et bloque toute requête, puis rend la main une fois la bannière retirée.
   * La fonction rendue lève le blocage : les réglages du public sont alors réappliqués avant toute requête.
   */
  suspend: () => Promise<() => void>;
}

const AdsContext = createContext<AdsApi | null>(null);

const noSubscription = () => () => {};

interface NativeState {
  applied: AdAudience | null;
  consent: ConsentState | null;
  consentFailedAt: number;
  /**
   * `unknown` : une vue native peut subsister (page rechargée, échec de chargement). Elle est retirée avant tout
   * nouvel affichage, car le plugin ne répond jamais à un `showBanner` quand une bannière existe déjà.
   */
  banner: "none" | "shown" | "hidden" | "unknown";
  margin: number;
  failedAt: number;
}

interface Desired {
  allowed: boolean;
  audience: AdAudience;
  visible: boolean;
  margin: number;
}

/**
 * Hauteur de la barre de navigation du bas, sans la marge système : 0 sur grand écran, où elle est masquée.
 * `null` tant qu'elle n'est pas mesurée : la bannière attend, sinon elle serait demandée deux fois au démarrage.
 */
function useBottomNavHeight(enabled: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const element = document.querySelector<HTMLElement>("[data-bottom-nav-bar]");
    const measure = () => setHeight(element?.getBoundingClientRect().height ?? 0);
    measure();
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);
  return enabled ? height : 0;
}

export function AdsProvider({ children }: { children: ReactNode }) {
  const { entitlements, status } = useEntitlements();
  const modalBusy = useModalBusy();
  const code = content.country.code;
  const config = content.country.ads;
  const native = useSyncExternalStore(noSubscription, isNativeApp, () => false);
  const adult = useSyncExternalStore(onAdultAnswerChange, () => readPromoState(code).adult, () => null);
  const [hideCount, setHideCount] = useState(0);
  const [suspendCount, setSuspendCount] = useState(0);
  const [consent, setConsent] = useState<ConsentState | null>(null);

  const allowed =
    suspendCount === 0 &&
    adsAllowed({
      configured: config !== null,
      native,
      // « offline » : droits d'un compte connecté illisibles, donc peut-être sans publicités. Aucune annonce dans le doute.
      entitlementsReady: status === "ready",
      adsRemoved: entitlements.adsRemoved,
      granted: entitlements.granted,
      forceNoAds: FORCE_NO_ADS,
    });
  const audience = adAudience(adult);
  const measured = useBottomNavHeight(allowed);
  const margin = measured ?? 0;
  const visible = allowed && measured !== null && hideCount === 0 && !modalBusy;

  const desired = useRef<Desired>({ allowed, audience, visible, margin });
  const state = useRef<NativeState>({ applied: null, consent: null, consentFailedAt: 0, banner: "unknown", margin: 0, failedAt: 0 });
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const suspended = useRef(0);

  const setBannerHeight = (height: number) => document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, `${Math.max(0, height)}px`);

  const updateConsent = (next: ConsentState | null) => {
    state.current.consent = next;
    setConsent(next);
  };

  /** Une étape vers l'état voulu. Chaque échec coupe la bannière : jamais d'annonce dans le doute. */
  const step = useCallback(async () => {
    const want = desired.current;
    const now = state.current;
    const adUnit = config?.admob.androidBannerAdUnitId;

    if (!want.allowed || !adUnit || (now.applied !== null && now.applied !== want.audience)) {
      if (now.banner !== "none") await removeBanner();
      now.banner = "none";
      now.applied = null;
      now.failedAt = 0;
      updateConsent(null);
      setBannerHeight(0);
      if (!want.allowed || !adUnit) return;
    }

    const settings = requestSettingsFor(want.audience);
    if (now.applied === null) {
      // Réglages d'âge appliqués avant toute requête. Échec : aucune annonce.
      await applyRequestSettings(settings);
      now.applied = want.audience;
    }

    if (!want.visible) {
      if (now.banner === "shown") {
        await hideBanner().catch(() => undefined);
        now.banner = "hidden";
      } else if (now.banner === "unknown") {
        await removeBanner();
        now.banner = "none";
      }
      return;
    }

    if (settings.consent === "ump" && now.consent === null) {
      // UMP indisponible (réseau) : nouvel essai à un prochain affichage, pas plus d'une fois par minute.
      if (Date.now() - now.consentFailedAt < ADS_RULES.retryAfterMs) return;
      try {
        updateConsent(await gatherConsent());
      } catch {
        now.consentFailedAt = Date.now();
        return;
      }
      // Le formulaire a pu prendre du temps : l'état voulu est relu au tour suivant.
      again.current = true;
      return;
    }

    if (!mayRequestBanner({ allowed: want.allowed, settingsApplied: now.applied, audience: want.audience, consent: now.consent })) {
      if (now.banner !== "none") await removeBanner();
      now.banner = "none";
      setBannerHeight(0);
      return;
    }

    if ((now.banner === "shown" || now.banner === "hidden") && now.margin === want.margin) {
      if (now.banner === "hidden") {
        await resumeBanner();
        now.banner = "shown";
      }
      return;
    }
    if (now.banner !== "none") await removeBanner();
    now.banner = "none";
    if (Date.now() - now.failedAt < ADS_RULES.retryAfterMs) return;
    await showBanner(adUnit, settings, want.margin);
    now.banner = "shown";
    now.margin = want.margin;
  }, [config]);

  /** Se termine quand l'état natif rejoint l'état voulu, y compris un changement demandé pendant le tour en cours. */
  const reconcile = useCallback((): Promise<void> => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const run = (async () => {
      try {
        do {
          again.current = false;
          if (suspended.current > 0) desired.current = { ...desired.current, allowed: false, visible: false };
          try {
            await step();
          } catch {
            // SDK indisponible : rien n'est affiché, l'état est repris à zéro au prochain changement.
            await removeBanner().catch(() => undefined);
            Object.assign(state.current, { applied: null, banner: "none" } satisfies Partial<NativeState>);
            setBannerHeight(0);
          }
        } while (again.current);
      } finally {
        running.current = null;
      }
    })();
    running.current = run;
    return run;
  }, [step]);

  useEffect(() => {
    desired.current = { allowed, audience, visible, margin };
    void reconcile();
  }, [allowed, audience, visible, margin, reconcile]);

  const suspend = useCallback(async () => {
    suspended.current += 1;
    setSuspendCount((count) => count + 1);
    // Sans attendre le rendu : `reconcile` lit `suspended` avant chaque étape.
    await reconcile();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      suspended.current -= 1;
      setSuspendCount((count) => count - 1);
    };
  }, [reconcile]);

  useEffect(() => {
    if (!allowed) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void listenBanner({
      onHeight: (height) => setBannerHeight(state.current.banner === "shown" ? height : 0),
      onFailed: () => {
        // Bannière vide retirée : la page ne garde pas d'espace réservé pour rien.
        state.current.failedAt = Date.now();
        state.current.banner = "unknown";
        setBannerHeight(0);
        void reconcile();
      },
    })
      .then((remove) => {
        if (cancelled) remove();
        else stop = remove;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [allowed, reconcile]);

  const hide = useCallback(() => {
    setHideCount((count) => count + 1);
    return () => setHideCount((count) => count - 1);
  }, []);

  const openPrivacyOptions = useCallback(async () => {
    updateConsent(await showPrivacyOptions());
    void reconcile();
  }, [reconcile]);

  const api = useMemo<AdsApi>(() => ({ hide, consent, openPrivacyOptions, suspend }), [hide, consent, openPrivacyOptions, suspend]);

  return <AdsContext value={api}>{children}</AdsContext>;
}

/** Masque la bannière tant que `hidden` est vrai : partie en cours, question d'âge, vidéo de promotion. */
export function useHideAdBanner(hidden: boolean): void {
  const api = use(AdsContext);
  const hide = api?.hide;
  useEffect(() => {
    if (!hidden || !hide) return;
    return hide();
  }, [hidden, hide]);
}

export function useAds(): AdsApi | null {
  return use(AdsContext);
}
