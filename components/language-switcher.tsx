"use client";

import { useLocale } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/types";

/** Переключатель языка. kk первым — это дефолт продукта. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t.a11y.switchLanguage}
      className="flex items-center gap-0.5 rounded-full border border-bedrock/25 p-0.5"
    >
      {LOCALES.map((code: Locale) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-current={active ? "true" : undefined}
            title={code}
            className={[
              "rounded-full px-2.5 py-1 font-display text-xs uppercase tracking-wide transition-colors",
              active ? "bg-ink text-chalk" : "text-bedrock hover:text-ink",
            ].join(" ")}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
