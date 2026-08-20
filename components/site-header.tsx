"use client";

import Link from "next/link";
import { useMessages } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

/** Черновая шапка дня 1: экраны появятся в дни 4–6. */
export function SiteHeader() {
  const t = useMessages();

  return (
    <header className="sticky top-0 z-20 border-b border-bedrock/15 bg-chalk/90 backdrop-blur">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-chalk"
      >
        {t.a11y.skipToContent}
      </a>

      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-base font-bold tracking-tight">
          TAMYR<span className="text-root-deep">.</span>AI
        </Link>

        <nav aria-label={t.nav.home} className="ml-auto hidden items-center gap-5 md:flex">
          <Link href="/diagnose" className="text-sm text-bedrock transition-colors hover:text-ink">
            {t.nav.diagnose}
          </Link>
          <Link href="/path" className="text-sm text-bedrock transition-colors hover:text-ink">
            {t.nav.path}
          </Link>
          <Link href="/dashboard" className="text-sm text-bedrock transition-colors hover:text-ink">
            {t.nav.dashboard}
          </Link>
          <Link href="/teacher" className="text-sm text-bedrock transition-colors hover:text-ink">
            {t.nav.teacher}
          </Link>
          <Link href="/about" className="text-sm text-bedrock transition-colors hover:text-ink">
            {t.nav.about}
          </Link>
        </nav>

        <div className="ml-auto md:ml-0">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
