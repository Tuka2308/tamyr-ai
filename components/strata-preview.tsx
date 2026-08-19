"use client";

import { useLocale } from "@/lib/i18n";
import type { Grade, LocalizedText } from "@/lib/types";

export type StratumNode = {
  id: string;
  title: LocalizedText;
  centrality: number;
};

export type Stratum = {
  grade: Grade;
  nodes: StratumNode[];
  /** Самый блокирующий узел слоя — подпись справа. */
  keyNode: StratumNode;
};

/**
 * Сигнатурный элемент — «Разрез».
 * Слои-классы: 8 наверху, 5 внизу. Чем глубже узел, тем ниже он лежит
 * на экране буквально. Здесь — статичная превью-версия для главной;
 * живая визуализация спуска появится на /diagnose (день 4).
 */
export function StrataPreview({ strata, rootId }: { strata: Stratum[]; rootId: string }) {
  const { locale, t } = useLocale();

  return (
    <div className="overflow-hidden rounded-2xl bg-ink text-chalk">
      <ul className="divide-y divide-chalk/8">
        {strata.map((stratum, depth) => (
          <li
            key={stratum.grade}
            className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:gap-6 sm:px-6"
            style={{ backgroundColor: `var(--color-strata-${stratum.grade})` }}
          >
            <div className="flex shrink-0 items-baseline gap-2 sm:w-24 sm:flex-col sm:gap-0">
              <span className="font-display text-3xl leading-none font-bold">{stratum.grade}</span>
              <span className="text-xs text-bedrock">{t.graph.gradeShort}</span>
            </div>

            <div
              className="flex flex-1 flex-wrap items-center gap-1.5"
              role="img"
              aria-label={`${stratum.grade} ${t.graph.gradeShort}: ${stratum.nodes.length} ${t.common.nodes}`}
            >
              {stratum.nodes.map((node) => {
                const isRoot = node.id === rootId;
                return (
                  <span
                    key={node.id}
                    title={node.title[locale]}
                    className={isRoot ? "node-root block h-2.5 w-2.5 rounded-full" : "block h-2.5 w-2.5 rounded-full"}
                    style={{
                      backgroundColor: isRoot ? "var(--color-root)" : "var(--color-bedrock)",
                      opacity: isRoot ? 1 : 0.35 + 0.5 * node.centrality,
                    }}
                  />
                );
              })}
            </div>

            <p className="shrink-0 text-xs text-bedrock sm:w-56 sm:text-right">
              {stratum.keyNode.title[locale]}
              <span className="ml-1 whitespace-nowrap text-chalk/70">
                {t.graph.blocks.replace("{n}", Math.round(stratum.keyNode.centrality * 100).toString())}
              </span>
            </p>

            <span className="sr-only">{`глубина слоя: ${depth}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
