"use client";

import { useLocale } from "@/lib/i18n";
import type { DiagnosisState, NodeVerdict } from "@/lib/diagnose";
import { bracketBounds, buildDisplayOrder } from "@/lib/trajectory";
import { loadGraph } from "@/lib/graph";
import type { Grade } from "@/lib/types";

/* ============================================================================
   «Разрез» — сигнатурный элемент интерфейса.

   Классы 5→8 это слои породы: 8 класс наверху, 5 внизу. Чем глубже пробел,
   тем ниже он лежит на экране буквально. Скобка слева — интервал [lo, hi]
   бинарного поиска: она сужается в реальном времени, и по ней видно, как
   алгоритм отсекает половину области за один ответ.

   Порядок строк берём из buildDisplayOrder, а не из алгоритмической цепочки:
   топологический порядок не монотонен по классам, и скобка прыгала бы между
   слоями. chainIndex при этом сохраняется — подписи сходятся с логами.
   ============================================================================ */

const graph = loadGraph();

type NodeState = "mastered" | "failed" | "testing" | "root" | "inRange" | "outOfRange";

function stateOf(
  nodeId: string,
  chainIndex: number,
  state: DiagnosisState,
  verdict: NodeVerdict | undefined,
): NodeState {
  if (state.result && state.result.root.id === nodeId) return "root";
  if (state.probe?.nodeId === nodeId) return "testing";
  if (verdict?.mastered === true) return "mastered";
  if (verdict?.mastered === false) return "failed";
  if (chainIndex >= state.lo && chainIndex <= state.hi) return "inRange";
  return "outOfRange";
}

const NODE_COLOR: Record<NodeState, string> = {
  mastered: "var(--color-spring)",
  failed: "var(--color-root)",
  testing: "var(--color-vein)",
  root: "var(--color-root)",
  inRange: "var(--color-bedrock)",
  outOfRange: "var(--color-bedrock)",
};

export function CrossSection({ state }: { state: DiagnosisState }) {
  const { locale, t } = useLocale();

  const display = buildDisplayOrder(state.chain, graph);
  const bracket = state.result ? null : bracketBounds(display, state.lo, state.hi);

  // Сверху вниз: старший класс первым. Метафора требует, чтобы 5 класс лежал внизу.
  const rows = [...display].reverse();
  const target = graph.byId.get(state.targetNodeId)!;

  const rowCount = rows.length;
  const bracketTop = bracket ? ((rowCount - 1 - bracket.to) / rowCount) * 100 : 0;
  const bracketHeight = bracket ? ((bracket.to - bracket.from + 1) / rowCount) * 100 : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-ink text-chalk">
      {/* Целевой узел — точка входа, отдельным блоком над разрезом. */}
      <div className="shrink-0 border-b border-chalk/10 bg-strata-8 px-4 py-3 sm:px-5">
        <p className="font-display text-[0.65rem] uppercase tracking-[0.16em] text-vein">
          {t.diagnose.entryTitle}
        </p>
        <p className="mt-1 text-sm font-medium leading-snug">{target.title[locale]}</p>
        <p className="mt-0.5 text-xs text-bedrock-light">
          {target.grade} {t.common.grade} · {t.diagnose.entryHint}
        </p>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        {/* Скобка интервала бинарного поиска. */}
        {bracket && rowCount > 0 && (
          <div
            className="pointer-events-none absolute left-1.5 z-10 w-2 rounded-full border-y-2 border-l-2 border-vein transition-all duration-500 ease-out motion-reduce:transition-none"
            style={{ top: `${bracketTop}%`, height: `${bracketHeight}%` }}
            aria-hidden="true"
          />
        )}

        <ul className="relative">
          {rows.map((row, i) => {
            const node = graph.byId.get(row.nodeId)!;
            const verdict = state.nodeVerdicts[row.nodeId];
            const nodeState = stateOf(row.nodeId, row.chainIndex, state, verdict);
            const prevGrade = rows[i - 1]?.grade;
            const startsStratum = prevGrade !== row.grade;

            return (
              <li
                key={row.nodeId}
                className="flex items-center gap-3 py-2 pl-6 pr-4 sm:pl-7 sm:pr-5"
                style={{ backgroundColor: strataColor(row.grade) }}
              >
                <span
                  className={[
                    "block h-3.5 w-3.5 shrink-0 rounded-full",
                    nodeState === "testing" ? "node-testing" : "",
                    nodeState === "root" ? "node-root" : "",
                  ].join(" ")}
                  style={{
                    backgroundColor:
                      nodeState === "inRange" || nodeState === "outOfRange"
                        ? "transparent"
                        : NODE_COLOR[nodeState],
                    border: `2px ${verdict?.confidence === "single_item" ? "dashed" : "solid"} ${NODE_COLOR[nodeState]}`,
                    opacity: nodeState === "outOfRange" ? 0.4 : 1,
                  }}
                />

                <span
                  className="min-w-0 flex-1 truncate text-xs sm:text-sm"
                  style={{ opacity: nodeState === "outOfRange" ? 0.45 : 1 }}
                  title={node.title[locale]}
                >
                  {node.title[locale]}
                </span>

                {startsStratum && (
                  <span className="shrink-0 font-display text-lg font-bold leading-none text-chalk/25">
                    {row.grade}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Легенда: состояния узлов должны читаться без объяснений ведущего. */}
      <ul className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-t border-chalk/10 px-4 py-2 text-[0.65rem] text-bedrock-light sm:px-5">
        <Legend color="var(--color-spring)" label={t.graph.stateMastered} />
        <Legend color="var(--color-vein)" label={t.graph.stateTesting} />
        <Legend color="var(--color-root)" label={t.graph.stateRoot} />
        <Legend color="var(--color-bedrock)" label={t.diagnose.confidenceWeak} dashed />
      </ul>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className="block h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          border: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        }}
      />
      {label}
    </li>
  );
}

function strataColor(grade: Grade): string {
  return `var(--color-strata-${grade})`;
}
