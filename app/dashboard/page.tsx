"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { gdiBand, GDI_BAND_LABELS } from "@/lib/gdi";
import { loadGraph } from "@/lib/graph";
import { useLocale } from "@/lib/i18n";
import { loadResult } from "@/lib/session";
import { buildFullTrajectory, type TrajectoryStep } from "@/lib/trajectory";
import type { DiagnosisResult } from "@/lib/types";

const graph = loadGraph();

/** Дата ЕНТ 2027 — ориентир обратного отсчёта. */
const ENT_DATE = new Date("2027-06-01T00:00:00Z");

export default function DashboardPage() {
  const { locale, t } = useLocale();
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [route, setRoute] = useState<TrajectoryStep[]>([]);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const stored = loadResult();
    setResult(stored);
    if (stored) {
      setRoute(
        buildFullTrajectory(stored.root.id, stored.target.id, {
          masteredNodeIds: stored.masteredNodeIds,
        }),
      );
    }
    // Считаем в эффекте: на сервере и клиенте «сегодня» разное, иначе разъедется гидратация.
    setDaysLeft(Math.max(0, Math.ceil((ENT_DATE.getTime() - Date.now()) / 86_400_000)));
  }, []);

  if (!result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-sm text-bedrock">{t.dashboard.empty}</p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-chalk"
        >
          {t.home.cta}
        </Link>
      </div>
    );
  }

  const band = gdiBand(result.gdi);
  const levelNodes = graph.nodes.filter((n) => n.grade <= result.target.grade);
  const masteredCount = result.masteredNodeIds.length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t.dashboard.title}</h1>
      <p className="mt-2 text-sm text-bedrock">{t.dashboard.lede}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label={t.dashboard.rootCard} accent="var(--color-root)">
          <p className="font-display text-base leading-snug font-bold">
            {result.root.title[locale]}
          </p>
          <p className="mt-1 text-xs text-bedrock">
            {result.root.grade} {t.common.grade}
          </p>
        </Card>

        <Card label={t.dashboard.gdiCard}>
          <p className="font-display text-4xl font-bold tabular-nums">{result.gdi.toFixed(2)}</p>
          <p className="mt-1 text-xs text-bedrock">{GDI_BAND_LABELS[band][locale]}</p>
        </Card>

        <Card label={t.dashboard.progressCard}>
          <p className="font-display text-4xl font-bold tabular-nums">{masteredCount}</p>
          <p className="mt-1 text-xs text-bedrock">
            {t.dashboard.ofTotal} {levelNodes.length}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bedrock/15">
            <div
              className="h-full rounded-full bg-spring"
              style={{ width: `${Math.round((masteredCount / levelNodes.length) * 100)}%` }}
            />
          </div>
        </Card>

        <Card label={t.dashboard.deadlineCard} accent="var(--color-vein)">
          <p className="font-display text-4xl font-bold tabular-nums">{daysLeft ?? "—"}</p>
          <p className="mt-1 text-xs text-bedrock">{t.dashboard.daysLeft}</p>
        </Card>
      </div>

      {/* Карта маршрута: где ученик находится прямо сейчас. */}
      <section className="mt-12">
        <h2 className="font-display text-sm font-semibold">{t.path.title}</h2>
        <ul className="mt-4 space-y-1.5">
          {route.map((step) => (
            <li key={step.node.id}>
              <Link
                href={`/node/${step.node.id}`}
                className="flex items-center gap-3 rounded-lg border border-bedrock/20 px-3 py-2.5 transition-colors hover:border-bedrock/50"
              >
                <span
                  className="block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      step.state === "root"
                        ? "var(--color-root)"
                        : step.state === "mastered"
                          ? "var(--color-spring)"
                          : step.state === "next"
                            ? "var(--color-vein)"
                            : "var(--color-bedrock)",
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{step.node.title[locale]}</span>
                <span className="shrink-0 text-xs text-bedrock">
                  {step.node.grade} {t.common.grade}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
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
