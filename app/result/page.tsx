"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiagnosisTrace } from "@/components/diagnosis-trace";
import { gdiBand, GDI_BAND_LABELS } from "@/lib/gdi";
import { loadGraph } from "@/lib/graph";
import { useLocale } from "@/lib/i18n";
import { loadResult } from "@/lib/session";
import type { DiagnosisResult } from "@/lib/types";

const graph = loadGraph();

/** Эмоциональный пик: «Ваш корень» и разбор индекса на D / B / C. */
export default function ResultPage() {
  const { locale, t } = useLocale();
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  useEffect(() => setResult(loadResult()), []);

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

  const band = gdiBand(result.gdi);
  const gradesDown = result.target.grade - result.root.grade;
  const refined = result.candidateBeforeRefinement !== result.root.id;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="font-display text-xs uppercase tracking-[0.18em] text-root">
        {t.result.kicker}
      </p>

      <h1 className="mt-3 font-display text-sm font-semibold text-bedrock">{t.result.rootIs}</h1>
      <p className="mt-1 font-display text-3xl leading-tight font-bold sm:text-4xl">
        {result.root.title[locale]}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-bedrock">
        <span>
          {result.root.grade} {t.common.grade}
        </span>
        {gradesDown > 0 && (
          <span className="text-root">
            ↓ {gradesDown} {t.result.gradesDown}
          </span>
        )}
        <span>
          {result.questionsAsked} {t.result.questionsUsed}
        </span>
      </div>

      <p className="mt-3 text-sm text-bedrock">
        {t.result.startedAt}: {result.target.title[locale]}
      </p>

      {/* Уточняющий проход — прямое доказательство, что мы не взяли ответ попроще. */}
      {refined && (
        <div className="mt-6 rounded-xl border-2 border-root/40 bg-root/5 p-4">
          <p className="font-display text-sm font-semibold text-root">{t.result.refinedTitle}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{t.result.refinedBody}</p>
          <p className="mt-2 text-xs text-bedrock">
            {graph.byId.get(result.candidateBeforeRefinement)?.title[locale]} →{" "}
            <span className="text-root">{result.root.title[locale]}</span>
          </p>
        </div>
      )}

      {/* ИГП с разбивкой: показываем компоненты, а не только итог. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-semibold">{t.result.gdiTitle}</h2>
          <span className="text-xs text-bedrock">{GDI_BAND_LABELS[band][locale]}</span>
        </div>

        <p className="mt-2 font-display text-5xl font-bold tabular-nums">
          {result.gdi.toFixed(2)}
        </p>

        <dl className="mt-6 space-y-4">
          <Component
            label={t.result.depth}
            hint={t.result.depthHint}
            value={result.igpInputs.depth}
          />
          <Component
            label={t.result.breadth}
            hint={t.result.breadthHint}
            value={result.igpInputs.breadth}
          />
          <Component
            label={t.result.centrality}
            hint={t.result.centralityHint}
            value={result.igpInputs.centrality}
          />
        </dl>
      </section>

      {/* Оговорки: слабое свидетельство и непроверенный барьер не прячем. */}
      <ul className="mt-8 space-y-2 text-xs text-bedrock">
        {result.confidence === "single_item" && <li>· {t.result.weakEvidence}</li>}
        {result.truncated && <li>· {t.result.truncated}</li>}
        {result.languageBarrier === "detected" && (
          <li className="text-vein">· {t.result.barrierDetected}</li>
        )}
        {result.languageBarrier === "not_assessed" && <li>· {t.result.barrierNotAssessed}</li>}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/path"
          className="rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-chalk"
        >
          {t.result.toPath}
        </Link>
        <Link
          href="/onboarding"
          className="rounded-full border-2 border-bedrock/30 px-6 py-3 font-display text-sm font-semibold text-bedrock hover:border-bedrock/60 hover:text-ink"
        >
          {t.result.retake}
        </Link>
      </div>

      <section className="mt-14">
        <h2 className="font-display text-sm font-semibold">{t.diagnose.traceTitle}</h2>
        <div className="mt-3">
          <DiagnosisTrace steps={result.steps} />
        </div>
      </section>
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
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-700 motion-reduce:transition-none"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-bedrock">{hint}</p>
    </div>
  );
}
