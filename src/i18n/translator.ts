import content from "@country";
import fr from "./locales/fr.json";

/** Le français sert de référence : toute langue ajoutée doit avoir exactement les mêmes clés. */
type UiMessages = typeof fr;
type PluralForms = { other: string };
type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | PluralForms ? `${Prefix}${K}` : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Clé de l'interface : une clé absente de fr.json ne compile pas. */
export type TranslationKey = LeafPaths<UiMessages>;
export type TranslationValues = Record<string, string | number>;
export type Messages = Record<string, unknown>;

export interface Translator {
  locale: string;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  /** Pour les clés issues du contenu (nom de région...), contrôlées par `npm run check:content`. */
  tContent: (key: string, values?: TranslationValues) => string;
  formatPrice: (cents: number, currency: string) => string;
}

const uiMessages: Record<string, UiMessages> = { fr };

export function getMessages(locale: string): Messages {
  return { ...(uiMessages[locale] ?? fr), ...content.messages[locale] };
}

function lookup(messages: Messages, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    return typeof node === "object" && node !== null ? (node as Messages)[part] : undefined;
  }, messages);
}

export function createTranslator(locale: string, messages: Messages): Translator {
  const plurals = new Intl.PluralRules(locale);

  const translate = (key: string, values: TranslationValues = {}) => {
    let entry = lookup(messages, key);
    if (typeof entry === "object" && entry !== null) {
      const forms = entry as Record<string, string>;
      entry = forms[plurals.select(Number(values.count ?? 0))] ?? forms.other;
    }
    if (typeof entry !== "string") return key;
    return entry.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
  };

  return {
    locale,
    t: translate,
    tContent: translate,
    formatPrice: (cents, currency) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100),
  };
}

/** Traducteur pour les composants serveur. */
export function getTranslator(locale: string = content.country.defaultLocale): Translator {
  return createTranslator(locale, getMessages(locale));
}
