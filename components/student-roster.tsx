"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";
import { loadGraph } from "@/lib/graph";
import { gdiBand } from "@/lib/gdi";
import type { ClassStudent } from "@/lib/types";

const graph = loadGraph();

/**
 * Список учеников класса.
 *
 * Реальные и демонстрационные разведены по группам и помечены значками.
 * Смешивать синтетику с настоящими данными молча нельзя — тот же принцип,
 * что у симулятора наивной системы и у пустого survey_results.json:
 * если данные не настоящие, это должно быть видно, а не спрятано.
 */
export function StudentRoster({ students }: { students: ClassStudent[] }) {
  const { t } = useLocale();

  const live = students.filter((s) => s.origin === "live");
  const demo = students.filter((s) => s.origin === "demo");

  return (
    <section aria-labelledby="roster-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="roster-title" className="font-display text-sm font-semibold">
          {t.teacher.rosterTitle}
        </h2>
        <p className="max-w-md text-xs text-bedrock">{t.teacher.rosterHint}</p>
      </div>

      {/* Реальные ученики */}
      <div className="mt-5">
        <h3 className="flex items-center gap-2 font-display text-xs font-semibold">
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-spring)" }}
            aria-hidden="true"
          />
          {t.teacher.rosterLive}
          <span className="font-normal text-bedrock">({live.length})</span>
        </h3>

        {live.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-bedrock/35 p-4">
            <p className="text-sm font-medium">{t.teacher.rosterEmpty}</p>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-bedrock">
              {t.teacher.rosterEmptyHint}
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {live.map((s) => (
              <StudentRow key={s.id} student={s} />
            ))}
          </ul>
        )}
      </div>

      {/* Демо-класс */}
      <div className="mt-8">
        <h3 className="flex items-center gap-2 font-display text-xs font-semibold text-bedrock">
          <span
            className="block h-2 w-2 rounded-full border border-dashed border-bedrock"
            aria-hidden="true"
          />
          {t.teacher.rosterDemo}
          <span className="font-normal">({demo.length})</span>
        </h3>
        <ul className="mt-3 space-y-1.5">
          {demo.map((s) => (
            <StudentRow key={s.id} student={s} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function StudentRow({ student }: { student: ClassStudent }) {
  const { locale, t } = useLocale();
  const root = graph.byId.get(student.rootNodeId);
  const isLive = student.origin === "live";
  const band = gdiBand(student.gdi);

  return (
    <li>
      <Link
        href={`/teacher/${encodeURIComponent(student.id)}`}
        className={[
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 transition-colors",
          isLive
            ? "border-spring/40 bg-spring/5 hover:border-spring/70"
            : "border-dashed border-bedrock/30 hover:border-bedrock/60",
        ].join(" ")}
      >
        <span className="font-medium" style={{ opacity: isLive ? 1 : 0.75 }}>
          {student.name}
        </span>

        <span
          className={[
            "shrink-0 rounded px-1.5 py-0.5 text-[0.65rem]",
            isLive ? "bg-spring/25 text-ink" : "border border-dashed border-bedrock/40 text-bedrock",
          ].join(" ")}
        >
          {isLive ? t.teacher.badgeLive : t.teacher.badgeDemo}
        </span>

        <span className="text-xs text-bedrock">
          {student.grade} {t.common.grade}
        </span>

        <span className="min-w-0 flex-1 truncate text-xs text-bedrock">
          {t.teacher.rosterRoot}: {root?.title[locale] ?? student.rootNodeId}
        </span>

        <span className="shrink-0 font-display text-xs font-bold tabular-nums">
          {student.gdi.toFixed(2)}
        </span>
        <span className="shrink-0 text-[0.65rem] text-bedrock">{band}</span>
      </Link>
    </li>
  );
}
