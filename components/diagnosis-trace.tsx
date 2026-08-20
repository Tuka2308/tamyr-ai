"use client";

import { useLocale } from "@/lib/i18n";
import { loadGraph } from "@/lib/graph";
import type { Step } from "@/lib/types";

const graph = loadGraph();

/**
 * «Путь диагностики» — обязательный элемент демо, а не отладочный вывод.
 * Показывает решение алгоритма на каждом шаге вместе с интервалом поиска
 * до и после: объяснимость должна быть видна на экране, а не только в коде.
 */
export function DiagnosisTrace({ steps }: { steps: Step[] }) {
  const { locale, t } = useLocale();

  if (steps.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-bedrock/30 p-4 text-xs text-bedrock">
        {t.diagnose.traceEmpty}
      </p>
    );
  }

  return (
    <ol className="space-y-1.5">
      {[...steps].reverse().map((step) => {
        const node = graph.byId.get(step.nodeId)!;
        const narrowed =
          step.intervalBefore[0] !== step.intervalAfter[0] ||
          step.intervalBefore[1] !== step.intervalAfter[1];

        return (
          <li
            key={step.index}
            className={[
              "rounded-lg border px-3 py-2 text-xs",
              step.phase === "boundary"
                ? "border-root/40 bg-root/5"
                : step.phase === "language_check"
                  ? "border-vein/50 bg-vein/5"
                  : "border-bedrock/20",
            ].join(" ")}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 shrink-0 font-display font-bold"
                style={{ color: step.correct ? "var(--color-spring-deep)" : "var(--color-root-deep)" }}
              >
                {step.correct ? "✓" : "✗"}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{node.title[locale]}</p>

                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-bedrock">
                  {step.phase === "boundary" && (
                    <span className="text-root-deep">◆ {t.diagnose.phaseBoundary}</span>
                  )}
                  {step.phase === "language_check" && (
                    <span className="text-vein-deep">{t.diagnose.phaseLanguageRoot}</span>
                  )}
                  {step.chainIndex !== null && <span>#{step.chainIndex}</span>}
                  {narrowed && (
                    <span className="font-mono">
                      {t.diagnose.intervalLabel} [{step.intervalBefore.join(",")}] → [
                      {step.intervalAfter.join(",")}]
                    </span>
                  )}
                  {step.confidence === "single_item" && (
                    <span className="rounded border border-dashed border-bedrock/50 px-1">
                      {t.diagnose.confidenceWeak}
                    </span>
                  )}
                </p>

                {step.demotedCandidate && (
                  <p className="mt-1 text-root-deep">
                    {t.diagnose.demoted}: {graph.byId.get(step.demotedCandidate)?.title[locale]}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
