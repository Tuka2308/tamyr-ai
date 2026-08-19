import type { Metadata, Viewport } from "next";
import { Golos_Text, Unbounded } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/types";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

/* Оба шрифта — с кириллицей, включая казахские ә ғ қ ң ө ұ ү і һ.
   Подгружаются через next/font (self-host на билде), без CDN в рантайме. */
const unbounded = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-unbounded",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const golos = Golos_Text({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600"],
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
