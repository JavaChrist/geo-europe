/**
 * Modèles de courriels produits par JavaChrist-Mail-Kit et copiés par `scripts/sync-mail.mjs`.
 * Les variables du kit ont la forme `{{ .Nom }}`. Toute valeur est échappée avant d'entrer dans le HTML.
 */
export type MailKind = "confirmation" | "reset-password" | "purchase-confirmation";

/** Modèles utilisés par l'application, et les variables que chacun doit contenir. Lu par la copie et par `npm run check`. */
export const MAIL_VARIABLES: Record<MailKind, readonly string[]> = {
  confirmation: ["ConfirmationURL"],
  "reset-password": ["ConfirmationURL"],
  "purchase-confirmation": ["ProductName", "Amount", "PurchaseDate", "OrderId", "TermsURL", "SiteURL"],
};

export interface MailTemplate {
  subject: string;
  html: string;
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

const VARIABLE = /\{\{ \.([A-Za-z]+) \}\}/g;

export const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decodeHtml = (value: string): string =>
  value.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

/** Remplit un modèle. Une variable sans valeur est une erreur : aucun courriel ne part avec un « {{ » visible. */
export function renderMail(template: MailTemplate, values: Record<string, string>): RenderedMail {
  const fill = (source: string, escape: (value: string) => string) =>
    source.replace(VARIABLE, (_, name: string) => {
      const value = values[name];
      if (value === undefined) throw new Error(`Variable de courriel sans valeur : ${name}`);
      return escape(value);
    });
  const html = fill(template.html, escapeHtml);
  return { subject: fill(template.subject, (value) => value), html, text: htmlToText(html) };
}

/** Version texte du courriel, pour les messageries qui n'affichent pas le HTML. Les liens restent lisibles. */
export function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<img[^>]*>/gi, "")
      .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => `${label.trim()} : ${href}`)
      .replace(/<\/(p|h1|h2|tr|table)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, index, lines) => line !== "" || (index > 0 && lines[index - 1] !== ""))
    .join("\n")
    .trim();
}

/** Montant affiché dans la confirmation d'achat, par exemple « 9,99 € ». */
export const formatAmount = (cents: number, currency: string, locale: string): string =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);

/** Date et heure d'achat, dans le fuseau du pays. */
export const formatPurchaseDate = (date: Date, locale: string, timeZone: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone }).format(date);
