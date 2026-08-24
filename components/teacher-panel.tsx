"use client";

import { AddQuestionForm } from "@/components/add-question-form";
import { HeatMap } from "@/components/heat-map";
import { useLocale } from "@/lib/i18n";
import { classSummary, topPriority } from "@/lib/teacher";
import { StudentRoster } from "@/components/student-roster";
import type { ClassStudent } from "@/lib/types";

export function TeacherPanel({ students }: { students: ClassStudent[] }) {
  const { locale, t } = useLocale();

  const summary = classSummary(students);
  const priority = topPriority(2, students);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t.teacher.title}</h1>
      <p className="mt-2 text-sm text-bedrock">{t.teacher.lede}</p>

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <span>
          <span className="font-display font-bold">{summary.total}</span>{" "}
          <span className="text-bedrock">{t.teacher.classOf}</span>
        </span>
        <span>
          <span className="text-bedrock">{t.teacher.averageGdi}:</span>{" "}
          <span className="font-display font-bold tabular-nums">
            {summary.averageGdi.toFixed(2)}
          </span>
        </span>
        {summary.deepest && (
          <span>
            <span className="text-bedrock">{t.teacher.deepestStudent}:</span>{" "}
            <span className="font-medium">{summary.deepest.name}</span>{" "}
            <span className="tabular-nums text-root-deep">{summary.deepest.gdi.toFixed(2)}</span>
          </span>
        )}
      </div>

      {/* Автоприоритет — главный ответ панели на вопрос «с чего начинать». */}
      <section className="mt-8 rounded-2xl border-2 border-root/40 bg-root/5 p-5 sm:p-6">
        <h2 className="font-display text-xs uppercase tracking-[0.14em] text-root-deep">
          {t.teacher.priorityTitle}
        </h2>

        <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-5xl font-bold tabular-nums sm:text-6xl">
            {Math.round(priority.studentShare * 100)}%
          </span>
          <span className="text-sm text-ink/80">{t.teacher.priorityMetric}</span>
        </p>

        <ul className="mt-4 space-y-1.5">
          {priority.nodes.map((hot) => (
            <li key={hot.node.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="font-medium">{hot.node.title[locale]}</span>
              <span className="text-xs text-bedrock">
                {hot.node.grade} {t.common.grade} · {hot.rootFor} {t.teacher.priorityStudents} ·{" "}
                {hot.errorCount} {t.teacher.priorityErrors}
              </span>
            </li>
          ))}
        </ul>

        {/* Сырые счётчики рядом с процентом — полная прозрачность метрики. */}
        <p className="mt-4 border-t border-root/20 pt-3 text-xs text-bedrock">
          {priority.studentCount} {t.common.of} {priority.totalStudents}{" "}
          {t.teacher.priorityStudents} · {priority.errorCount} {t.common.of}{" "}
          {priority.totalErrors} {t.teacher.priorityErrors}
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-bedrock">{t.teacher.priorityHint}</p>
      </section>

      <div className="mt-12">
        <StudentRoster students={students} />
      </div>

      <div className="mt-14">
        <HeatMap students={students} />
      </div>

      <div className="mt-14">
        <AddQuestionForm />
      </div>
    </div>
  );
}
