"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CrossSection } from "@/components/cross-section";
import { DiagnosisTrace } from "@/components/diagnosis-trace";
import { QuestionPanel } from "@/components/question-panel";
import { currentQuestion, startDiagnosis, submitAnswer, type DiagnosisState } from "@/lib/diagnose";
import { useLocale } from "@/lib/i18n";
import { DEFAULT_PROFILE, loadProfile, saveResult, TARGET_BY_GRADE } from "@/lib/session";
import { syncStudent } from "@/lib/student-sync";

/**
 * Главный экран демо. Сплит 60/40: слева живой разрез на всю высоту,
 * справа панель текущего вопроса и путь диагностики.
 *
 * Вся диагностика крутится тем же редьюсером, что и юнит-тесты, — состояние
 * лежит в useState и целиком сериализуемо.
 */
export default function DiagnosePage() {
  const router = useRouter();
  const { t } = useLocale();
  // Стартуем синхронно на дефолтном профиле: так экран рендерится на сервере
  // и первый кадр не пустой. localStorage на сервере недоступен, поэтому
  // сохранённый профиль подхватываем следом — гидратация при этом сходится,
  // потому что первый клиентский рендер тоже идёт от дефолта.
  const [state, setState] = useState<DiagnosisState>(() =>
    startDiagnosis(TARGET_BY_GRADE[DEFAULT_PROFILE.grade], {
      studentGrade: DEFAULT_PROFILE.grade,
    }),
  );

  useEffect(() => {
    const profile = loadProfile();
    if (!profile || profile.grade === DEFAULT_PROFILE.grade) return;
    setState(startDiagnosis(TARGET_BY_GRADE[profile.grade], { studentGrade: profile.grade }));
  }, []);

  const answer = useCallback((index: number | null) => {
    setState((prev) => submitAnswer(prev, index));
  }, []);

  // Диагностика завершена — сохраняем результат и уводим на экран корня.
  useEffect(() => {
    if (!state.result) return;
    saveResult(state.result);

    // Отправка учителю — дополнительный шаг ПОСЛЕ сохранения результата.
    // Не ждём её и не показываем ошибок: для ученика ничего не меняется.
    const profile = loadProfile();
    if (profile) void syncStudent(profile, state.result);

    const timer = window.setTimeout(() => router.push("/result"), 900);
    return () => window.clearTimeout(timer);
  }, [state.result, router]);

  const question = currentQuestion(state);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] lg:gap-8">
        {/* Разрез. На мобильном сворачивается в вертикальную ленту слоёв. */}
        <div className="order-2 min-w-0 h-[26rem] lg:order-1 lg:h-[calc(100dvh-8rem)] lg:min-h-[34rem]">
          <CrossSection state={state} />
        </div>

        <div className="order-1 min-w-0 lg:order-2 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
          {question ? (
            <QuestionPanel state={state} question={question} onAnswer={answer} />
          ) : (
            <section aria-live="polite" className="rounded-2xl border-2 border-root/40 bg-root/5 p-5">
              <p className="font-display text-xs uppercase tracking-[0.14em] text-root">
                {t.result.kicker}
              </p>
              <p className="mt-2 font-display text-xl font-bold">{t.result.rootIs}…</p>
              <Link
                href="/result"
                className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-chalk"
              >
                {t.common.next}
              </Link>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-display text-sm font-semibold">{t.diagnose.traceTitle}</h2>
            <div className="mt-3">
              <DiagnosisTrace steps={state.steps} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
