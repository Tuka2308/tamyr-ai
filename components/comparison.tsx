"use client";

import { loadGraph } from "@/lib/graph";
import { useLocale } from "@/lib/i18n";
import { responderFromResult, runNaiveBaseline } from "@/lib/naive-baseline";
import type { DiagnosisResult } from "@/lib/types";

const graph = loadGraph();

/**
 * Два пути рядом: правило «упрости задание» против спуска по предпосылкам.
 *
 * Левая колонка — симуляция, а не замер чужого продукта. Дисклеймер стоит
 * над сравнением, а не мелким шрифтом внизу: заявлять, что мы тестировали
 * конкурентов, мы не имеем права, и прятать это было бы нечестно.
 */
export function Comparison({ result }: { result: DiagnosisResult }) {
  const { locale, t } = useLocale();

  const naive = runNaiveBaseline(result.target.id, responderFromResult(result));
  const syntheticCount = naive.steps.filter((s) => s.synthetic).length;
  const gradesDown = result.target.grade - result.root.grade;

  return (
    <section aria-labelledby="compare-title">
      <h2 id="compare-title" className="font-display text-sm font-semibold">
        {t.compare.title}
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-bedrock">{t.compare.disclaimer}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* Наивная система */}
        <div className="flex flex-col rounded-xl border-2 border-bedrock/25 p-4">
          <h3 className="font-display text-sm font-semibold text-bedrock">
            {t.compare.naiveTitle}
          </h3>
          <p className="mt-1 text-xs text-bedrock">{t.compare.naiveRule}</p>

          <ul className="mt-4 space-y-1" aria-hidden="true">
            {naive.steps.map((step) => (
              <li key={step.index} className="flex items-center gap-2">
                <span
                  className="block h-1.5 flex-1 rounded-full"
                  style={{
                    backgroundColor: step.correct ? "var(--color-spring)" : "var(--color-root)",
                    opacity: step.synthetic ? 0.35 : 0.75,
                  }}
                />
                <span className="w-16 shrink-0 text-right text-[0.65rem] text-bedrock">
                  {result.target.grade} {t.common.grade}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-bedrock">{t.compare.stayedHere}</p>

          <dl className="mt-auto space-y-1 pt-4 text-xs">
            <Row label={t.compare.questions} value={String(naive.questionsAsked)} />
            <Row label={t.compare.nodesVisited} value={String(naive.nodesVisited)} />
            <Row label={t.compare.gradesDown} value={String(naive.gradesDescended)} />
            <Row label={t.compare.causeFound} value={t.compare.no} tone="var(--color-root)" />
          </dl>

          <p className="mt-3 border-t border-bedrock/20 pt-3 text-xs font-medium">
            {t.compare.naiveConclusion}
          </p>
        </div>

        {/* TAMYR */}
        <div className="flex flex-col rounded-xl border-2 border-root/40 bg-root/5 p-4">
          <h3 className="font-display text-sm font-semibold text-root">{t.compare.tamyrTitle}</h3>
          <p className="mt-1 text-xs text-bedrock">{t.compare.tamyrRule}</p>

          {/* Ступеньки вниз: каждый шаг спуска смещён правее и ниже. */}
          <ul className="mt-4 space-y-1">
            {result.steps.map((step) => {
              const grade = gradeOf(result, step.nodeId);
              const depth = result.target.grade - grade;
              return (
                <li key={step.index} className="flex items-center gap-2">
                  <span style={{ width: `${depth * 14}px` }} aria-hidden="true" />
                  <span
                    className="block h-1.5 flex-1 rounded-full"
                    style={{
                      backgroundColor: step.correct ? "var(--color-spring)" : "var(--color-root)",
                      opacity: step.phase === "boundary" ? 1 : 0.75,
                    }}
                  />
                  <span className="w-16 shrink-0 text-right text-[0.65rem] text-bedrock">
                    {grade} {t.common.grade}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs font-medium text-root">{result.root.title[locale]}</p>

          <dl className="mt-auto space-y-1 pt-4 text-xs">
            <Row label={t.compare.questions} value={String(result.questionsAsked)} />
            <Row
              label={t.compare.nodesVisited}
              value={String(new Set(result.steps.map((s) => s.nodeId)).size)}
            />
            <Row label={t.compare.gradesDown} value={String(gradesDown)} tone="var(--color-root)" />
            <Row label={t.compare.causeFound} value={t.compare.yes} tone="var(--color-spring)" />
          </dl>

          <p className="mt-3 border-t border-root/20 pt-3 text-xs font-medium">
            {t.compare.tamyrOutcome}: {result.root.title[locale]} ({result.root.grade}{" "}
            {t.common.grade})
          </p>
        </div>
      </div>

      {syntheticCount > 0 && (
        <p className="mt-3 text-xs text-bedrock">
          {t.compare.syntheticNote.replace("{n}", String(syntheticCount))}
        </p>
      )}
    </section>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-bedrock">{label}</dt>
      <dd className="font-display font-bold tabular-nums" style={{ color: tone }}>
        {value}
      </dd>
    </div>
  );
}

/** Класс узла берём из графа напрямую — восстанавливать его по позиции нельзя. */
function gradeOf(result: DiagnosisResult, nodeId: string): number {
  return graph.byId.get(nodeId)?.grade ?? result.target.grade;
}
