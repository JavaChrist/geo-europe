"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { createTranslator, getMessages, type Translator } from "./translator";

const I18nContext = createContext<Translator | null>(null);

/**
 * Le dictionnaire est lu ici, dans le bundle client (un seul chunk, en cache et hors ligne),
 * et jamais passé en prop depuis le layout : une prop serait sérialisée dans chaque page HTML
 * et chaque segment RSC de l'export statique (environ 3 Mo par fichier).
 */
export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const translator = useMemo(() => createTranslator(locale, getMessages(locale)), [locale]);
  return <I18nContext value={translator}>{children}</I18nContext>;
}

/** Traducteur pour les composants client. */
export function useTranslation(): Translator {
  const translator = use(I18nContext);
  if (!translator) throw new Error("useTranslation doit être utilisé dans I18nProvider");
  return translator;
}
