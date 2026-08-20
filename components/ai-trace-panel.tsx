"use client";

import { useState } from "react";
import type { ExplainResponse } from "@/app/api/explain/route";
import { buildAiTrace, TAG_LABEL, type TraceItem, type TraceTone } from "@/lib/ai-trace";
import { useLocale } from "@/lib/i18n";
import type { MisconceptionTag } from "@/lib/types";

const TONE_COLOR: Record<TraceTone, string> = {
  neutral: "var(--color-bedrock)",
  good: "var(--color-spring)",
  warn: "var(--color-vein)",
  bad: "var(--color-root)",
};

/**
 * «След ИИ»: из чего именно собрано объяснение.
 *
 * Каждая строка выводится из полей реального ответа /api/explain — числа,
 * тег ошибки и вердикт верификации не зашиты в компонент. Логика вынесена
 * в lib/ai-trace.ts и покрыта тестами: панель обязана меняться вместе
 * с ответом, иначе она вводила бы в заблуждение.
 */
export function AiTracePanel({ response }: { response: ExplainResponse | null }) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);

  const items = buildAiTrace(response);
  if (items.length === 0) return null;

  return (
    <div className="mt-4 border-t border-bedrock/15 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 text-xs text-bedrock underline underline-offset-4 hover:text-ink"
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        {t.aiTrace.title}
      </button>

      {open && (
        <ol className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.step} className="flex items-start gap-2.5 text-xs">
              <span
                className="mt-1 block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: TONE_COLOR[item.tone] }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="leading-relaxed">{line(item, locale, t)}</p>

                {item.step === "retrieval" && item.details.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-bedrock">
                    {item.details.map((source) => (
                      <li key={source}>· {source}</li>
                    ))}
                  </ul>
                )}

                {item.step === "verification" && item.details.length > 0 && (
                  <div className="mt-1.5 rounded border border-root/40 bg-root/5 px-2 py-1.5">
                    <p className="font-medium text-root-deep">{t.aiTrace.unsupportedTitle}</p>
                    <ul className="mt-1 space-y-0.5">
                      {item.details.map((claim) => (
                        <li key={claim}>· {claim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function line(
  item: TraceItem,
  locale: "kk" | "ru" | "en",
  t: ReturnType<typeof useLocale>["t"],
): string {
  switch (item.step) {
    case "retrieval":
      return t.aiTrace.retrieval.replace("{n}", String(item.value));

    case "generation": {
      const tag = item.value as MisconceptionTag;
      if (tag === "none" || tag === "unknown") return t.aiTrace.generationNone;
      return t.aiTrace.generation.replace("{tag}", TAG_LABEL[tag][locale]);
    }

    case "verification":
      if (item.value === true) return t.aiTrace.verificationOk;
      if (item.value === false) return t.aiTrace.verificationBad;
      return t.aiTrace.verificationUnknown;

    case "origin":
      if (item.value === "cached") return t.aiTrace.originCached;
      if (item.value === "generated") return t.aiTrace.originGenerated;
      return t.aiTrace.originChunk;
  }
}
