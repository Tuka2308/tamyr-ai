"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { heatLevel, hotNodes, type HeatLevel } from "@/lib/teacher";
import { seedStudents } from "@/lib/students";
import { loadGraph } from "@/lib/graph";

const graph = loadGraph();

const LEVEL_COLOR: Record<HeatLevel, string> = {
  root: "var(--color-root)",
  error: "var(--color-vein)",
  blocked: "var(--color-bedrock)",
  mastered: "var(--color-spring)",
  out_of_scope: "transparent",
};

const LEVEL_OPACITY: Record<HeatLevel, number> = {
  root: 1,
  error: 0.85,
  blocked: 0.3,
  mastered: 0.4,
  out_of_scope: 1,
};

/**
 * Тепловая карта класса: 25 учеников × узлы, где у класса есть пробелы.
 *
 * Колонок 11, а не 75, намеренно: 64 пустых колонки размывают концентрацию,
 * ради которой карта и существует. Полный список программы доступен ниже
 * по кнопке — это подача, а не сокрытие.
 */
export function HeatMap() {
  const { locale, t } = useLocale();
  const [showAll, setShowAll] = useState(false);

  const hot = hotNodes();
  const hotIds = new Set(hot.map((h) => h.node.id));
  const rest = graph.nodes.filter((n) => !hotIds.has(n.id));

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">{t.teacher.heatTitle}</h2>
        <p className="text-xs text-bedrock">{t.teacher.heatHint}</p>
      </div>

      {/* Широкая таблица скроллится внутри себя, страница по горизонтали не едет. */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-bedrock/20">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">
            {t.teacher.heatTitle}: {seedStudents.length} {t.teacher.classOf} × {hot.length}{" "}
            {t.common.nodes}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-chalk px-3 py-2 text-left font-medium text-bedrock"
              >
                {t.teacher.classOf}
              </th>
              {hot.map((h) => (
                <th
                  key={h.node.id}
                  scope="col"
                  className="px-1 py-2 align-bottom"
                  title={h.node.title[locale]}
                >
                  {/* Вертикальные подписи: иначе 11 колонок не помещаются. */}
                  <span
                    className="mx-auto block h-28 whitespace-nowrap text-left font-medium text-bedrock"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {h.node.title[locale].slice(0, 26)}
                  </span>
                  <span className="mt-1 block text-center font-display text-[0.65rem] text-ink">
                    {h.rootFor}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seedStudents.map((student) => (
              <tr key={student.id} className="border-t border-bedrock/10">
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-chalk px-3 py-1.5 text-left font-normal"
                >
                  {student.name}
                  <span className="ml-2 text-bedrock">{student.grade}</span>
                </th>
                {hot.map((h) => {
                  const level = heatLevel(student, h.node.id, graph);
                  return (
                    <td key={h.node.id} className="px-1 py-1.5">
                      <span
                        className="mx-auto block h-4 w-4 rounded"
                        style={{
                          backgroundColor: LEVEL_COLOR[level],
                          opacity: LEVEL_OPACITY[level],
                          border:
                            level === "out_of_scope"
                              ? "1px dashed color-mix(in srgb, var(--color-bedrock) 30%, transparent)"
                              : "none",
                        }}
                        title={`${student.name} — ${h.node.title[locale]}: ${legendLabel(level, t)}`}
                      />
                      <span className="sr-only">{legendLabel(level, t)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-bedrock">
        <Legend color="var(--color-root)" label={t.teacher.legendRoot} />
        <Legend color="var(--color-vein)" label={t.teacher.legendError} />
        <Legend color="var(--color-bedrock)" label={t.teacher.legendBlocked} opacity={0.3} />
        <Legend color="var(--color-spring)" label={t.teacher.legendMastered} opacity={0.4} />
        <Legend color="transparent" label={t.teacher.legendOut} dashed />
      </ul>

      {/* Остальные 64 узла — доступны, но не мешают. */}
      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        aria-expanded={showAll}
        className="mt-5 text-sm text-bedrock underline underline-offset-4 hover:text-ink"
      >
        {showAll ? t.teacher.hideAll : t.teacher.showAll}
      </button>

      {showAll && (
        <div className="mt-4 rounded-xl border border-bedrock/20 p-4">
          <h3 className="font-display text-xs font-semibold">{t.teacher.allNodesTitle}</h3>
          <ul className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((node) => (
              <li key={node.id} className="flex items-baseline gap-2 text-bedrock">
                <span className="shrink-0 font-display text-[0.65rem]">{node.grade}</span>
                <span className="min-w-0 flex-1 truncate">{node.title[locale]}</span>
                <span className="shrink-0 text-[0.65rem] opacity-60">{t.teacher.noGaps}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function legendLabel(level: HeatLevel, t: ReturnType<typeof useLocale>["t"]): string {
  const map: Record<HeatLevel, string> = {
    root: t.teacher.legendRoot,
    error: t.teacher.legendError,
    blocked: t.teacher.legendBlocked,
    mastered: t.teacher.legendMastered,
    out_of_scope: t.teacher.legendOut,
  };
  return map[level];
}

function Legend({
  color,
  label,
  opacity,
  dashed,
}: {
  color: string;
  label: string;
  opacity?: number;
  dashed?: boolean;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className="block h-3 w-3 rounded"
        style={{
          backgroundColor: color,
          opacity: opacity ?? 1,
          border: dashed
            ? "1px dashed color-mix(in srgb, var(--color-bedrock) 40%, transparent)"
            : "none",
        }}
      />
      {label}
    </li>
  );
}
