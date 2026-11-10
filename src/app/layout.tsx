import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import type { ReactNode } from "react";
import content from "@country";
import { EntitlementsProvider } from "@/features/account/EntitlementsProvider";
import { AdsProvider } from "@/features/ads/AdsProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { UpdatePrompt } from "@/features/update/UpdatePrompt";
import { getTranslator } from "@/i18n/translator";
import { AppHeader } from "@/ui/AppHeader";
import { ModalProvider } from "@/ui/modal/ModalProvider";
import { BottomNav } from "@/ui/nav/BottomNav";
import { LeaveGuardHost } from "@/ui/nav/leave-guard";
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
        <I18nProvider locale={locale}>
          <ModalProvider>
            <EntitlementsProvider>
              <AdsProvider>
                {/* Réserve la hauteur de la barre fixe, et de la bannière AdMob de l'application Android, pour qu'elles ne masquent jamais le contenu. */}
                <div className="pb-[calc(4rem+env(safe-area-inset-bottom)+var(--ad-banner-h,0px))] lg:pb-[var(--ad-banner-h,0px)]">
                  <AppHeader />
                  {children}
                </div>
                <BottomNav />
                <UpdatePrompt />
                <LeaveGuardHost />
              </AdsProvider>
            </EntitlementsProvider>
          </ModalProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
