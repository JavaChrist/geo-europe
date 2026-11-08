import content from "@country";
import templates from "@country-mail";
import nodemailer, { type Transporter } from "nodemailer";
import { renderMail, type MailKind } from "@/engine/mail";
import { ServerConfigError } from "@/services/firebase/admin";

// Serveur uniquement : le mot de passe SMTP ne doit jamais atteindre le navigateur.
if (typeof window !== "undefined") throw new Error("L'envoi de courriels est réservé au serveur");

/**
 * Envoi des courriels de l'application par SMTP (IONOS), avec les modèles de JavaChrist-Mail-Kit.
 * Les réglages viennent des variables d'environnement, jamais du dépôt. Sans elles, aucun envoi :
 * une erreur de configuration est levée, et la route répond « indisponible ».
 */
let transporter: Transporter | null = null;

const isLoopback = (host: string) => host === "127.0.0.1" || host === "localhost" || host === "::1";

function transport(): Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host) throw new ServerConfigError("SMTP_HOST");
  if (!user) throw new ServerConfigError("SMTP_USER");
  if (!pass) throw new ServerConfigError("SMTP_PASSWORD");
  if (!process.env.MAIL_FROM) throw new ServerConfigError("MAIL_FROM");
  const port = Number(process.env.SMTP_PORT ?? 465);
  // Serveur SMTP local des tests sans chiffrement : accepté uniquement avec les émulateurs Firebase.
  const plainTest = isLoopback(host) && Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  return (transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465 && !plainTest,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  }));
}

/** Lève `ServerConfigError` si l'envoi n'est pas configuré, avant toute recherche de compte. */
export function assertMailConfigured(): void {
  transport();
}

export interface Attachment {
  filename: string;
  content: string;
  contentType: string;
}

/** Remplit le modèle du kit puis l'envoie. L'adresse de réponse est celle du support. */
export async function sendTemplateMail(kind: MailKind, to: string, values: Record<string, string>, attachments: Attachment[] = []): Promise<void> {
  const mail = renderMail(templates.templates[kind], values);
  await transport().sendMail({
    from: process.env.MAIL_FROM,
    replyTo: process.env.MAIL_REPLY_TO ?? content.country.legal.supportEmail,
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments,
  });
}
