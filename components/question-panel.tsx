"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import type { DiagnosisState } from "@/lib/diagnose";
import { QUESTION_LIMIT } from "@/lib/diagnose";
import type { Question } from "@/lib/types";

/** Подпись фазы. Проверки формулировки подписаны явно и по-разному
 *  для цели и для кандидата в корень — иначе два подряд «то же самое,
 *  но короче» читаются как баг рендера. */
function phaseLabel(state: DiagnosisState, t: ReturnType<typeof useLocale>["t"]): string {
  switch (state.phase) {
    case "target":
      return t.diagnose.phaseTarget;
    case "descent":
      return t.diagnose.phaseDescent;
    case "boundary":
      return t.diagnose.phaseBoundary;
    case "language_check":
      return state.languageCheck?.probe.role === "target"
        ? t.diagnose.phaseLanguageTarget
        : t.diagnose.phaseLanguageRoot;
    default:
      return "";
  }
}

export function QuestionPanel({
  state,
  question,
  onAnswer,
}: {
  state: DiagnosisState;
  question: Question;
  onAnswer: (index: number | null) => void;
}) {
  const { locale, t } = useLocale();
  const [selected, setSelected] = useState<number | null>(null);

  const submit = (index: number | null) => {
    setSelected(null);
    onAnswer(index);
  };

  const isLanguageCheck = state.phase === "language_check";
  const isBoundary = state.phase === "boundary";

  return (
    <section aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p
          className={[
            "font-display text-[0.7rem] uppercase tracking-[0.14em]",
            isLanguageCheck ? "text-vein" : isBoundary ? "text-root" : "text-bedrock",
          ].join(" ")}
        >
          {isBoundary && "◆ "}
          {phaseLabel(state, t)}
        </p>
        <p className="text-xs text-bedrock">
          {t.common.question} {state.questionsAsked + 1} {t.common.of} {QUESTION_LIMIT}
        </p>
      </div>

      <h2 className="mt-4 text-lg leading-snug font-medium sm:text-xl">{question.text[locale]}</h2>

      <ul className="mt-6 space-y-2">
        {question.options.map((option, index) => {
          const active = selected === index;
          return (
            <li key={`${question.id}-${index}`}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-pressed={active}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                  active
                    ? "border-ink bg-ink text-chalk"
                    : "border-bedrock/25 bg-white hover:border-bedrock/50",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-xs",
                    active ? "bg-chalk text-ink" : "bg-bedrock/10 text-bedrock",
                  ].join(" ")}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-sm sm:text-base">{option}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={selected === null}
          onClick={() => submit(selected)}
          className="rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-chalk transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
        >
          {t.diagnose.check}
        </button>
        <button
          type="button"
          onClick={() => submit(null)}
          className="text-sm text-bedrock underline underline-offset-4 hover:text-ink"
        >
          {t.diagnose.skip}
        </button>
      </div>
    </section>
  );
}
