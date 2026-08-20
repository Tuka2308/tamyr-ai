"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { loadResult } from "@/lib/session";
import { buildFullTrajectory, type TrajectoryState, type TrajectoryStep } from "@/lib/trajectory";
import type { DiagnosisResult } from "@/lib/types";

/** Цвет маркера-точки: нетекстовый элемент, достаточно 3:1. */
const STATE_COLOR: Record<TrajectoryState, string> = {
  mastered: "var(--color-spring)",
  root: "var(--color-root)",
  next: "var(--color-vein)",
  locked: "var(--color-bedrock)",
  target: "var(--color-ink)",
};

/** Цвет ПОДПИСИ: яркие акценты не проходят 4,5:1 на светлом фоне. */
const STATE_TEXT_COLOR: Record<TrajectoryState, string> = {
  mastered: "var(--color-spring-deep)",
  root: "var(--color-root-deep)",
  next: "var(--color-vein-deep)",
  locked: "var(--color-bedrock)",
  target: "var(--color-ink)",
};

/** Траектория снизу вверх: от найденного корня к цели. */
export default function PathPage() {
  const { locale, t } = useLocale();
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [steps, setSteps] = useState<TrajectoryStep[]>([]);

  useEffect(() => {
    const stored = loadResult();
    setResult(stored);
    if (stored) {
      setSteps(
        buildFullTrajectory(stored.root.id, stored.target.id, {
          masteredNodeIds: stored.masteredNodeIds,
        }),
      );
    }
  }, []);

  if (!result) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-bedrock">{t.path.empty}</p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-chalk"
        >
          {t.home.cta}
        </Link>
      </div>
    );
  }

  const label: Record<TrajectoryState, string> = {
    mastered: t.path.stateMastered,
    root: t.path.stateRoot,
    next: t.path.stateNext,
    locked: t.path.stateLocked,
    target: t.path.stateTarget,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t.path.title}</h1>
      <p className="mt-2 text-sm text-bedrock">{t.path.lede}</p>

      {/* Снизу вверх: корень внизу списка, цель наверху — как в разрезе. */}
      <ol className="mt-8 space-y-0">
        {[...steps].reverse().map((step, i, arr) => {
          const color = STATE_COLOR[step.state];
          const textColor = STATE_TEXT_COLOR[step.state];
          const isLast = i === arr.length - 1;

          return (
            <li key={step.node.id} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast && (
                <span
                  className="absolute left-[0.4375rem] top-5 bottom-0 w-0.5 bg-bedrock/20"
                  aria-hidden="true"
                />
              )}

              <span
                className={[
                  "relative z-10 mt-1 block h-3.5 w-3.5 shrink-0 rounded-full",
                  step.state === "root" ? "node-root" : "",
                ].join(" ")}
                style={{
                  backgroundColor: step.state === "locked" ? "transparent" : color,
                  border: `2px solid ${color}`,
                }}
              />

              {/* Кликабельны ВСЕ узлы: задания есть у каждого из 75,
                  а объяснение честно деградирует там, где нет чанков. */}
              <Link
                href={`/node/${step.node.id}`}
                className="min-w-0 flex-1 rounded-lg transition-colors hover:bg-bedrock/5"
              >
                <p
                  className="font-medium leading-snug"
                  style={{ opacity: step.state === "locked" ? 0.55 : 1 }}
                >
                  {step.node.title[locale]}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-bedrock">
                  <span>
                    {step.node.grade} {t.common.grade}
                  </span>
                  <span style={{ color: textColor }}>{label[step.state]}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ol>

      <Link
        href="/result"
        className="mt-10 inline-block text-sm text-bedrock underline underline-offset-4 hover:text-ink"
      >
        {t.path.backToResult}
      </Link>
    </div>
  );
}
