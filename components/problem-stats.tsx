"use client";

import statsFile from "@/data/problem_stats.json";
import surveyFile from "@/data/survey_results.json";
import { useLocale } from "@/lib/i18n";
import type { Stat, StatsFile } from "@/lib/types";

const problem = statsFile as unknown as StatsFile;
const survey = surveyFile as unknown as StatsFile;

/**
 * Блок проверяемых фактов о проблеме.
 *
 * Сознательно НЕ сделан «градиентными карточками с большой цифрой и мелкой
 * подписью» — дизайн-план это исключает. Здесь утилитарные строки: число
 * набрано ровно настолько крупно, чтобы читаться, а не чтобы давить.
 * Источник не спрятан: он раскрывается по клику прямо рядом с числом.
 */
export function ProblemStats() {
  const { t } = useLocale();

  return (
    <section aria-labelledby="stats-title" className="border-t border-bedrock/20 pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="stats-title" className="font-display text-sm font-semibold">
          {t.stats.title}
        </h2>
        <p className="text-xs text-bedrock">{t.stats.lede}</p>
      </div>

      <ul className="mt-6 grid gap-px overflow-hidden rounded-xl bg-bedrock/20 sm:grid-cols-2">
        {problem.stats.map((stat) => (
          <StatRow key={stat.id} stat={stat} />
        ))}
      </ul>

      {/* Опрос учеников: данных нет — говорим об этом, а не прячем раздел. */}
      <div className="mt-4 rounded-xl border border-dashed border-bedrock/35 px-4 py-3">
        <p className="font-display text-xs font-semibold text-bedrock">{t.stats.surveyTitle}</p>
        <p className="mt-1 text-xs text-bedrock">
          {survey.status === "collecting" ? t.stats.surveyCollecting : null}
        </p>
      </div>
    </section>
  );
}

function StatRow({ stat }: { stat: Stat }) {
  const { locale, t } = useLocale();

  // Факт про интернет — разворот аргумента: сеть есть, а результата нет.
  // Он выделен акцентом, потому что несёт мысль, а не только цифру.
  const isPivot = stat.id === "rural_internet";

  return (
    <li className="bg-chalk p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="font-display text-xl font-bold tabular-nums sm:text-2xl"
          style={{ color: isPivot ? "var(--color-vein-deep)" : undefined }}
        >
          {stat.value}
        </span>
        <span className="min-w-0 flex-1 text-sm leading-snug text-ink/80">
          {stat.label[locale]}
        </span>
      </div>

      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-xs text-bedrock underline underline-offset-4 hover:text-ink">
          {t.stats.sourceLabel}
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-bedrock">{stat.note[locale]}</p>
        <p className="mt-1.5 text-xs text-ink/60">{stat.source}</p>
      </details>
    </li>
  );
}
