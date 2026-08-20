import type { Metadata, Viewport } from "next";
import { Golos_Text, Unbounded } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/types";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

/* Оба шрифта — с кириллицей, включая казахские ә ғ қ ң ө ұ ү і һ.
   Подгружаются через next/font (self-host на билде), без CDN в рантайме.

   weight не указан: оба семейства вариативные (в CSS видно font-weight:200 900
   и 400 900), поэтому перечислять начертания незачем — вариативный файл
   покрывает все используемые веса 400/500/600/700 сам, и добавление нового
   веса в разметке не потребует правки здесь.

   ЗАМЕР: со списком весов и без него сборка получается байт в байт одинаковой —
   9 файлов woff2, 305 КБ, на страницу приезжает 7 файлов и 274 КБ. То есть
   выигрыша по весу это не даёт, только убирает лишнюю связанность.

   Именно эти 274 КБ и держат LCP около 3,1 с в Lighthouse на медленном
   мобильном канале — одинаково на всех страницах. Ускорить можно только
   display: "optional", но тогда первый визит целиком пройдёт на системном
   шрифте, а Unbounded и Golos — часть дизайн-решения. Размен не наш. */
const unbounded = Unbounded({
  subsets: ["cyrillic", "latin"],
  variable: "--font-unbounded",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const golos = Golos_Text({
  subsets: ["cyrillic", "latin"],
  variable: "--font-golos",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "TAMYR AI",
  description:
    "Находит не то, что ученик не знает, а то, почему: спускается по графу предпосылок до корневого пробела.",
  applicationName: "TAMYR AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TAMYR AI", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#12141C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} className={`${unbounded.variable} ${golos.variable}`}>
      <body className="min-h-dvh bg-chalk text-ink antialiased">
        <LocaleProvider>
          <ServiceWorkerRegistrar />
          <SiteHeader />
          <main id="content">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
