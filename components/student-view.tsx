"use client";

import Link from "next/link";
import { gdiBand, GDI_BAND_LABELS } from "@/lib/gdi";
import { loadGraph } from "@/lib/graph";
import { useLocale } from "@/lib/i18n";
import { buildFullTrajectory } from "@/lib/trajectory";
import type { ClassStudent } from "@/lib/types";

const graph = loadGraph();

/**
 * Кабинет ученика для учителя. Читает те же данные, что видит сам ученик
 * на /dashboard, но без действий: панель учителя ничего не меняет.
 */
export function StudentView({ student }: { student: ClassStudent }) {
  const { locale, t } = useLocale();

  const root = graph.byId.get(student.rootNodeId);
  const target = graph.byId.get(student.targetNodeId);
  const band = gdiBand(student.gdi);
  const isDemo = student.origin === "demo";

  const route =
    root && target
      ? buildFullTrajectory(root.id, target.id, { masteredNodeIds: student.masteredNodeIds })
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/teacher"
        className="text-sm text-bedrock underline underline-offset-4 hover:text-ink"
      >
        ← {t.teacher.viewBack}
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{student.name}</h1>
        <span
          className={[
            "rounded px-2 py-0.5 text-xs",
            isDemo
              ? "border border-dashed border-bedrock/40 text-bedrock"
              : "bg-spring/25 text-ink",
          ].join(" ")}
        >
          {isDemo ? t.teacher.badgeDemo : t.teacher.badgeLive}
        </span>
      </div>

      <p className="mt-1 text-sm text-bedrock">
        {student.grade} {t.common.grade} · {t.teacher.viewReadOnly}
      </p>

      {/* Синтетический профиль обязан быть подписан на его собственной странице,
          а не только в списке: сюда можно попасть по прямой ссылке. */}
      {isDemo && (
        <p className="mt-4 rounded-xl border border-dashed border-bedrock/40 px-4 py-3 text-xs leading-relaxed text-bedrock">
          {t.teacher.viewDemoWarning}
        </p>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Card label={t.dashboard.rootCard} accent="var(--color-root)">
          <p className="font-display text-base leading-snug font-bold">
            {root?.title[locale] ?? student.rootNodeId}
          </p>
          <p className="mt-1 text-xs text-bedrock">
            {root?.grade} {t.common.grade}
          </p>
        </Card>

        <Card label={t.dashboard.gdiCard}>
          <p className="font-display text-4xl font-bold tabular-nums">{student.gdi.toFixed(2)}</p>
          <p className="mt-1 text-xs text-bedrock">{GDI_BAND_LABELS[band][locale]}</p>
        </Card>

        <Card label={t.dashboard.progressCard}>
          <p className="font-display text-4xl font-bold tabular-nums">
            {student.masteredNodeIds.length}
          </p>
          <p className="mt-1 text-xs text-bedrock">
            {student.questionsAsked} {t.result.questionsUsed}
          </p>
        </Card>
      </div>

      {/* Разбивка индекса — учитель видит, из чего он сложился. */}
      <section className="mt-10">
        <h2 className="font-display text-sm font-semibold">{t.result.gdiTitle}</h2>
        <dl className="mt-4 space-y-4">
          <Component label={t.result.depth} hint={t.result.depthHint} value={student.gdiInputs.depth} />
          <Component label={t.result.breadth} hint={t.result.breadthHint} value={student.gdiInputs.breadth} />
          <Component
            label={t.result.centrality}
            hint={t.result.centralityHint}
            value={student.gdiInputs.centrality}
          />
        </dl>
      </section>

      {/* История ошибок */}
      <section className="mt-10">
        <h2 className="font-display text-sm font-semibold">{t.teacher.viewErrors}</h2>
        {student.errors.length === 0 ? (
          <p className="mt-2 text-sm text-bedrock">{t.teacher.viewNoErrors}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {student.errors.map((e, i) => (
              <li
                key={`${e.questionId}-${i}`}
                className="flex flex-wrap items-baseline gap-x-3 rounded-lg border border-bedrock/20 px-3 py-2 text-xs"
              >
                <span className="font-medium">
                  {graph.byId.get(e.nodeId)?.title[locale] ?? e.nodeId}
                </span>
                <span className="text-bedrock">{e.tag}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Траектория */}
      {route.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-sm font-semibold">{t.path.title}</h2>
          <ol className="mt-3 space-y-1.5">
            {route.map((step) => (
              <li
                key={step.node.id}
                className="flex items-center gap-3 rounded-lg border border-bedrock/20 px-3 py-2"
              >
                <span
                  className="block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      step.state === "root"
                        ? "var(--color-root)"
                        : step.state === "mastered"
                          ? "var(--color-spring)"
                          : "var(--color-bedrock)",
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{step.node.title[locale]}</span>
                <span className="shrink-0 text-xs text-bedrock">
                  {step.node.grade} {t.common.grade}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Card({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border-2 p-4"
      style={{ borderColor: accent ?? "color-mix(in srgb, var(--color-bedrock) 25%, transparent)" }}
    >
      <p className="font-display text-[0.7rem] uppercase tracking-[0.12em] text-bedrock">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Component({ label, hint, value }: { label: string; hint: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="font-display text-sm font-semibold">{label}</dt>
        <dd className="font-display text-sm tabular-nums">{value.toFixed(2)}</dd>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bedrock/15">
        <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-bedrock">{hint}</p>
    </div>
  );
}
