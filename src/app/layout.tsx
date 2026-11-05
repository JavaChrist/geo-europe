import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import type { ReactNode } from "react";
import content from "@country";
import { I18nProvider } from "@/i18n/I18nProvider";
import { UpdatePrompt } from "@/features/update/UpdatePrompt";
import { getMessages, getTranslator } from "@/i18n/translator";
import { AppHeader } from "@/ui/AppHeader";
import { ModalProvider } from "@/ui/modal/ModalProvider";
import { BottomNav } from "@/ui/nav/BottomNav";
import "./globals.css";

const body = Figtree({ subsets: ["latin"], variable: "--font-body" });
const title = Fraunces({ subsets: ["latin"], variable: "--font-title" });

const { country } = content;

export const metadata: Metadata = {
  title: country.appName,
  description: getTranslator().t("meta.description"),
  icons: {
    icon: [{ url: country.icons.favicon }, { url: country.icons.faviconSvg, type: "image/svg+xml" }],
    apple: country.icons.apple,
  },
};

export const viewport: Viewport = {
  themeColor: country.themeColor,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = country.defaultLocale;
  return (
    <html lang={locale} className={`${body.variable} ${title.variable}`}>
      <body>
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <ModalProvider>
            {/* Réserve la hauteur de la barre fixe pour qu'elle ne masque jamais le contenu. */}
            <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
              <AppHeader />
              {children}
            </div>
            <BottomNav />
            <UpdatePrompt />
          </ModalProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
