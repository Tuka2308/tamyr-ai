"use client";

import Link from "next/link";
import { useMessages } from "@/lib/i18n";
import { ProblemStats } from "./problem-stats";
import { StrataPreview, type Stratum } from "./strata-preview";

export function HomeView({ strata, rootId }: { strata: Stratum[]; rootId: string }) {
  const t = useMessages();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      {/* Асимметричная сетка: тезис слева и шире, разрез справа. */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <section>
          {/* Резерва высоты здесь сознательно НЕТ.
              Резерв под две строки фолбэка давал лучший CLS (0,0256 против
              0,0384), но худшую картинку: сдвиги кикера (−16px) и заголовка
              (+34px) при подмене шрифта гасят друг друга, и без резерва
              видимый скачок вдвое меньше — 18px вместо 34px. Выбран спокойный
              экран, а не красивая метрика; 0,0384 всё равно втрое ниже
              порога «хорошо» (0,1). Замер: 400 Кбит/с, CPU ×4, 412px. */}
          <p className="font-display text-xs uppercase tracking-[0.18em] text-bedrock">
            {t.home.kicker}
          </p>

          <h1 className="mt-5 font-display text-3xl leading-[1.12] font-bold sm:text-5xl">
            {t.home.thesis}
            <br />
            <span className="text-root-deep">{t.home.thesisAccent}</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink/80 sm:text-lg">
            {t.home.lede}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-chalk transition-opacity hover:opacity-90"
            >
              {t.home.cta}
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-bedrock/20 p-4">
              <h2 className="font-display text-sm font-semibold text-bedrock">
                {t.home.contrastTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{t.home.contrastOthers}</p>
            </div>
            <div className="rounded-xl border-2 border-root/40 bg-root/5 p-4">
              <h2 className="font-display text-sm font-semibold text-root-deep">TAMYR</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{t.home.contrastTamyr}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="strata-title">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="strata-title" className="font-display text-sm font-semibold">
              {t.home.strataTitle}
            </h2>
            <p className="text-xs text-bedrock">{t.home.strataHint}</p>
          </div>
          <StrataPreview strata={strata} rootId={rootId} />
        </section>
      </div>

      <div className="mt-16">
        <ProblemStats />
      </div>
    </div>
  );
}
