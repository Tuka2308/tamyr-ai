import type { MetadataRoute } from "next";

/**
 * Манифест PWA. Приложение ставится на домашний экран и работает офлайн —
 * это не украшение: продукт адресован школам со слабой связью, и офлайн
 * заявлен как основной сценарий, а не бонус.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TAMYR AI — находит корневой пробел в знаниях",
    short_name: "TAMYR AI",
    description:
      "Находит не то, что вы не знаете, а то, почему: спускается по графу предпосылок до корневого пробела.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#12141C",
    theme_color: "#12141C",
    lang: "kk",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
