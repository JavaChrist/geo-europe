"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { createTranslator, type Messages, type Translator } from "./translator";

const I18nContext = createContext<Translator | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: string; messages: Messages; children: ReactNode }) {
  const translator = useMemo(() => createTranslator(locale, messages), [locale, messages]);
  return <I18nContext value={translator}>{children}</I18nContext>;
}

/** Traducteur pour les composants client. */
export function useTranslation(): Translator {
  const translator = use(I18nContext);
  if (!translator) throw new Error("useTranslation doit être utilisé dans I18nProvider");
  return translator;
}
