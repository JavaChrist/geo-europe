"use client";

/**
 * Garde de sortie pendant une partie : la navigation du bas, l'en-tête, tout lien interne et le bouton retour
 * (navigateur ou Android) passent par la même modale avant de quitter l'écran de jeu.
 *
 * - Liens : un écouteur de clic en phase de capture sur `document`, déclenché avant le `onClick` de `next/link`.
 * - Retour : une entrée d'historique « piège » à la même adresse. Le retour la consomme, la modale s'ouvre,
 *   et l'entrée est remise tant que le joueur continue.
 * - Android : MainActivity demande d'abord à la page (`__geoNativeBack`) ; pendant une partie, le bouton retour ouvre la modale
 *   sans toucher à l'historique, que Chromium peut sauter (entrée ajoutée sans geste du joueur).
 *
 * Même principe que `useHoldUpdate` : un compteur au niveau du module, lu par un seul hôte placé dans le layout.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useModal } from "@/ui/modal/ModalProvider";
import type { ModalContent } from "@/ui/modal/types";

export interface LeaveGuardOptions {
  /** Texte de la modale ; le titre, « Continuer le quiz » et « Quitter » sont fournis par défaut. */
  bodyKey: ModalContent["bodyKey"];
  /** Écran parent, quand il n'y a rien avant la partie dans l'historique (ouverture directe, lien partagé). */
  backHref: string;
  /** Appelé juste avant de quitter, après confirmation. */
  onLeave?: () => void;
}

interface Guard {
  options: { current: LeaveGuardOptions };
}

const guards: Guard[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const isGuarded = () => guards.length > 0;

/** Marque l'entrée d'historique ajoutée par le garde. Next.js recopie ses propres champs à côté. */
const TRAP_KEY = "__geoLeaveTrap";

const history = {
  /** Vrai tant que l'entrée piège est l'entrée courante. */
  onTrap: false,
  /** Adresse de l'écran de jeu, notée à la pose du premier piège. */
  gameUrl: "",
  /**
   * Vrai quand le navigateur a sauté l'entrée de jeu : Chromium ignore au retour une entrée suivie d'un ajout fait
   * sans geste du joueur, comme le piège remis dans `popstate`. L'entrée précédente est alors déjà l'écran d'avant.
   */
  skipped: false,
  /** Ignore le prochain `popstate` : celui de notre propre retour en arrière. */
  ignorePop: false,
  /** Vrai entre la confirmation et le départ : plus rien n'est intercepté. */
  leaving: false,
};

function pushTrap() {
  if (history.onTrap) return;
  if (!history.gameUrl) history.gameUrl = window.location.href;
  // Même adresse que l'écran de jeu : Next.js recopie son état sans relancer de restauration, l'écran ne bouge pas.
  // Si le retour a sauté l'entrée de jeu, l'adresse affichée est celle de l'écran d'avant : on remet celle du jeu.
  const moved = window.location.href !== history.gameUrl;
  if (moved) history.skipped = true;
  window.history.pushState({ [TRAP_KEY]: true }, "", moved ? history.gameUrl : undefined);
  history.onTrap = true;
}

/** Retire l'entrée piège quand la partie se termine sur place (écran de résultat). */
function dropTrap() {
  if (!history.onTrap) return;
  history.onTrap = false;
  if (history.skipped) {
    // L'entrée de jeu d'origine n'existe plus : le piège devient l'entrée de jeu, sans doublon dans l'historique.
    window.history.replaceState({}, "");
    return;
  }
  history.ignorePop = true;
  window.history.back();
}

/**
 * Appelé par MainActivity au bouton retour d'Android, avant toute remontée d'historique de la WebView.
 * Rend `true` quand une partie est en cours : la modale s'ouvre et Android ne fait rien d'autre.
 */
const NATIVE_BACK = "__geoNativeBack";
type NativeBackWindow = Window & { [NATIVE_BACK]?: () => boolean };

/** Nombre d'entrées avant l'entrée courante, quand le navigateur le dit (API Navigation). */
function entriesBefore(): number | null {
  const navigation = (window as Window & { navigation?: { currentEntry?: { index: number } | null } }).navigation;
  const index = navigation?.currentEntry?.index;
  return typeof index === "number" && index >= 0 ? index : null;
}

const MODAL: Omit<ModalContent, "bodyKey"> = {
  titleKey: "journey.leave.title",
  confirmKey: "journey.leave.confirm",
  cancelKey: "journey.leave.cancel",
};

let asking: Promise<boolean> | null = null;

/**
 * Protège l'écran tant que `active` est vrai. Rend deux sorties confirmées pour le bouton « Quitter » du jeu :
 * `leave()` va vers `backHref`, `back()` revient à l'écran précédent (ou `backHref` s'il n'y en a pas).
 */
export function useLeaveGuard(active: boolean, options: LeaveGuardOptions) {
  const modal = useModal();
  const router = useRouter();
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!active) return;
    const guard: Guard = { options: optionsRef };
    guards.push(guard);
    history.leaving = false;
    notify();
    return () => {
      guards.splice(guards.indexOf(guard), 1);
      notify();
    };
  }, [active]);

  const confirm = () => confirmLeave(modal.confirm);

  return {
    leave: async () => {
      if (await confirm()) navigateAway(router, optionsRef.current.backHref);
    },
    back: async () => {
      if (await confirm()) goBackAway(router, optionsRef.current.backHref);
    },
  };
}

type Confirm = ReturnType<typeof useModal>["confirm"];
type Router = ReturnType<typeof useRouter>;

/**
 * Une seule modale à la fois, même si le joueur appuie plusieurs fois sur retour.
 * Seule la demande qui l'a ouverte décide de la destination : les suivantes ne mènent nulle part.
 */
function confirmLeave(confirm: Confirm): Promise<boolean> {
  const guard = guards.at(-1);
  if (!guard) return Promise.resolve(true);
  if (asking) return asking.then(() => false);
  asking = confirm({ ...MODAL, bodyKey: guard.options.current.bodyKey }).finally(() => {
    asking = null;
  });
  return asking;
}

function release() {
  history.leaving = true;
  guards.at(-1)?.options.current.onLeave?.();
}

function navigateAway(router: Router, href: string) {
  release();
  // L'entrée piège est remplacée : l'historique reste celui d'une navigation normale.
  if (history.onTrap) {
    history.onTrap = false;
    router.replace(href);
  } else router.push(href);
}

function goBackAway(router: Router, fallbackHref: string) {
  release();
  const before = entriesBefore();
  const steps = history.onTrap && !history.skipped ? 2 : 1;
  if (before !== null && before < steps) {
    // Ouvert directement sur la partie : rien avant, on va vers l'écran parent.
    navigateAway(router, fallbackHref);
    return;
  }
  history.onTrap = false;
  window.history.go(-steps);
}

/** Lien interne à intercepter, ou `null` pour laisser le navigateur faire. */
function internalHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Une ancre dans la page ne quitte pas la partie.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** À placer une fois dans le layout, sous ModalProvider. */
export function LeaveGuardHost() {
  const modal = useModal();
  const router = useRouter();
  const guarded = useSyncExternalStore(subscribe, isGuarded, () => false);

  useEffect(() => {
    if (!guarded) return;
    pushTrap();

    const onClick = (event: MouseEvent) => {
      if (history.leaving) return;
      const href = internalHref(event);
      if (!href) return;
      // Avant le gestionnaire de next/link : sans confirmation, aucune navigation ne démarre.
      event.preventDefault();
      event.stopPropagation();
      void confirmLeave(modal.confirm).then((confirmed) => {
        if (confirmed) navigateAway(router, href);
      });
    };

    // Position de défilement du joueur : le navigateur remet celle de l'entrée précédente avant `popstate`,
    // alors que l'événement `scroll` de ce saut n'arrive qu'à l'image suivante.
    let scrollY = window.scrollY;
    const onScroll = () => {
      scrollY = window.scrollY;
    };

    const onPopState = (event: PopStateEvent) => {
      if (history.ignorePop) {
        history.ignorePop = false;
        event.stopImmediatePropagation();
        return;
      }
      if (history.leaving) return;
      // Le retour vient de consommer l'entrée piège : la page reste la même, Next.js n'a rien à restaurer.
      event.stopImmediatePropagation();
      const kept = scrollY;
      window.scrollTo(0, kept);
      requestAnimationFrame(() => window.scrollTo(0, kept));
      history.onTrap = false;
      pushTrap();
      askBack();
    };

    const askBack = () => {
      void confirmLeave(modal.confirm).then((confirmed) => {
        const backHref = guards.at(-1)?.options.current.backHref;
        if (confirmed && backHref) goBackAway(router, backHref);
      });
    };

    // Android : le bouton retour ne touche pas l'historique pendant la partie, il ouvre directement la modale.
    (window as NativeBackWindow)[NATIVE_BACK] = () => {
      if (!history.leaving) askBack();
      return true;
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    // En capture : appelé avant l'écouteur de Next.js, enregistré plus tôt sur `window`.
    window.addEventListener("popstate", onPopState, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState, true);
      delete (window as NativeBackWindow)[NATIVE_BACK];
      // Partie terminée sur place : l'entrée piège disparaît. Après un départ confirmé, elle est déjà remplacée ou passée.
      if (!history.leaving) dropTrap();
      else {
        history.onTrap = false;
      }
      history.gameUrl = "";
      history.skipped = false;
    };
  }, [guarded, modal, router]);

  // Garde le dernier `popstate` ignoré même après la fin de la partie.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (!history.ignorePop || isGuarded()) return;
      history.ignorePop = false;
      event.stopImmediatePropagation();
    };
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, []);

  return null;
}
