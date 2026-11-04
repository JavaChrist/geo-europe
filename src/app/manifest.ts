import type { MetadataRoute } from "next";
import content from "@country";
import { getTranslator } from "@/i18n/translator";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const { country } = content;
  return {
    name: country.appName,
    short_name: country.appName,
    description: getTranslator().t("meta.description"),
    lang: country.defaultLocale,
    start_url: "/",
    display: "standalone",
    theme_color: country.themeColor,
    background_color: country.backgroundColor,
    icons: [
      { src: country.icons.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: country.icons.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
