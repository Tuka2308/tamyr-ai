"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ExplainResponse } from "@/app/api/explain/route";
import { explain as resolveExplanation } from "@/lib/explain-client";
import { useLocale } from "@/lib/i18n";
import { loadResult } from "@/lib/session";
import { teacherQuestionsForNode } from "@/lib/teacher-store";
import type { MisconceptionTag, Node, Question } from "@/lib/types";

/**
 * Экран узла: объяснение (или честная заглушка) + задания + разбор ошибки.
 *
 * Разбор ошибки показывается через машиночитаемый тег и текст варианта,
 * а прозу misconception на других языках напрямую не выводим — она написана
 * по-русски и предназначена для /api/explain, который отвечает на языке
 * пользователя. Показывать русский текст казахоязычному ученику молча нельзя.
 */
export function NodeView({ node, questions }: { node: Node; questions: Question[] }) {
  const { locale, t } = useLocale();

  // Задания, добавленные учителем, дописываются в конец списка. Читаем их
  // в эффекте, а не при рендере: localStorage на сервере нет, и первый
  // клиентский рендер обязан совпасть с серверным, иначе разъедется гидратация.
  const [teacherAdded, setTeacherAdded] = useState<Question[]>([]);
  useEffect(() => setTeacherAdded(teacherQuestionsForNode(node.id)), [node.id]);
  const allQuestions = [...questions, ...teacherAdded];
  const teacherIds = new Set(teacherAdded.map((q) => q.id));

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const question = allQuestions[index];
  const isRoot = typeof window !== "undefined" && loadResult()?.root.id === node.id;

  // Тег ошибки уточняет объяснение: просим разобрать именно ту ошибку,
  // которую ученик только что допустил.
  const tag: MisconceptionTag =
    checked && question && selected !== null && selected !== question.correctIndex
      ? (question.misconceptionTags?.[selected] ?? "unknown")
      : "none";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Кэш разрешается локально — сеть нужна только при промахе.
    resolveExplanation(node.id, tag, locale)
      .then((data) => {
        if (!cancelled) setExplain(data);
      })
      .catch(() => {
        if (!cancelled) setExplain(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [node.id, tag, locale]);

  const correct = question !== undefined && selected === question.correctIndex;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="font-display text-xs uppercase tracking-[0.16em] text-bedrock">
        {node.grade} {t.common.grade}
        {isRoot && <span className="ml-2 text-root">· {t.path.stateRoot}</span>}
      </p>
      <h1 className="mt-2 font-display text-2xl leading-tight font-bold sm:text-3xl">
        {node.title[locale]}
      </h1>

      {/* --- Объяснение ---------------------------------------------------- */}
      <section className="mt-8 rounded-2xl border-2 border-bedrock/20 p-5">
        <h2 className="font-display text-sm font-semibold">{t.node.explanationTitle}</h2>

        {loading && <p className="mt-3 text-sm text-bedrock">{t.node.loading}</p>}

        {!loading && (!explain || explain.status === "unavailable") && (
          <div className="mt-3">
            <p className="text-sm font-medium">{t.node.unavailable}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-bedrock">
              {t.node.unavailableHint}
            </p>
          </div>
        )}

        {!loading && explain?.explanation && (
          <>
            {explain.status === "chunk_fallback" && (
              <p className="mt-3 rounded-lg border border-vein/50 bg-vein/10 px-3 py-2 text-xs">
                {explain.reason === "verification_failed"
                  ? t.node.verificationFailed
                  : t.node.chunkFallback}
              </p>
            )}

            {explain.languageFallback && (
              <p className="mt-3 rounded-lg border border-bedrock/30 px-3 py-2 text-xs text-bedrock">
                {t.node.langNote}
              </p>
            )}

            <div className="mt-3 space-y-3 text-sm leading-relaxed">
              {explain.explanation.split("\n\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            {/* Маркер источника — обязателен рядом с любым объяснением. */}
            {explain.sources.length > 0 && (
              <p className="mt-4 border-t border-bedrock/15 pt-3 text-xs text-bedrock">
                {t.node.basedOn}:{" "}
                {explain.sources.map((source, i) => (
                  <span key={source}>
                    {i > 0 && "; "}
                    <span className="text-ink/70">{source}</span>
                  </span>
                ))}
              </p>
            )}
          </>
        )}
      </section>

      {/* --- Задания -------------------------------------------------------- */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-semibold">{t.node.tasksTitle}</h2>
          <span className="text-xs text-bedrock">
            {allQuestions.length} {t.node.taskCount}
            {teacherAdded.length > 0 && (
              <span className="ml-2 rounded bg-vein/25 px-1.5 py-0.5 text-[0.65rem] text-ink">
                +{teacherAdded.length} {t.teacher.addedBadge}
              </span>
            )}
          </span>
        </div>

        {question ? (
          <div className="mt-4">
            <p className="text-base leading-snug font-medium sm:text-lg">
              {question.text[locale]}
            </p>
            {teacherIds.has(question.id) && (
              <p className="mt-1.5 text-xs text-bedrock">
                <span className="rounded bg-vein/25 px-1.5 py-0.5 text-ink">
                  {t.teacher.addedBadge}
                </span>
              </p>
            )}

            <ul className="mt-5 space-y-2">
              {question.options.map((option, i) => {
                const isPicked = selected === i;
                const isAnswer = i === question.correctIndex;
                const reveal = checked && (isPicked || isAnswer);

                return (
                  <li key={`${question.id}-${i}`}>
                    <button
                      type="button"
                      disabled={checked}
                      onClick={() => setSelected(i)}
                      aria-pressed={isPicked}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:cursor-default",
                        reveal && isAnswer
                          ? "border-spring bg-spring/10"
                          : reveal && isPicked
                            ? "border-root bg-root/10"
                            : isPicked
                              ? "border-ink bg-ink text-chalk"
                              : "border-bedrock/25 bg-white",
                      ].join(" ")}
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-bedrock/10 font-display text-xs">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm sm:text-base">{option}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Обратная связь обязательна — разбор именно выбранного варианта. */}
            {checked && selected !== null && (
              <div
                className={[
                  "mt-5 rounded-xl border-2 p-4",
                  correct ? "border-spring/50 bg-spring/5" : "border-root/40 bg-root/5",
                ].join(" ")}
              >
                <p
                  className="font-display text-sm font-semibold"
                  style={{ color: correct ? "var(--color-spring)" : "var(--color-root)" }}
                >
                  {correct ? t.node.correct : t.node.wrong}
                </p>

                {!correct && (
                  <>
                    <p className="mt-2 text-xs uppercase tracking-wide text-bedrock">
                      {t.node.whyWrong}
                    </p>
                    <p className="mt-1 text-sm">
                      {question.options[selected]} —{" "}
                      <span className="text-bedrock">
                        {tagLabel(question.misconceptionTags?.[selected] ?? "unknown", locale)}
                      </span>
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">
                      {question.options[question.correctIndex]} —{" "}
                      <span className="text-spring">{t.node.correct}</span>
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!checked ? (
                <button
                  type="button"
                  disabled={selected === null}
                  onClick={() => setChecked(true)}
                  className="rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-chalk disabled:opacity-35"
                >
                  {t.diagnose.check}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={index >= allQuestions.length - 1}
                  onClick={() => {
                    setIndex((i) => i + 1);
                    setSelected(null);
                    setChecked(false);
                  }}
                  className="rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-chalk disabled:opacity-35"
                >
                  {index >= allQuestions.length - 1 ? t.node.done : t.node.nextTask}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-bedrock">{t.node.done}</p>
        )}
      </section>

      <Link
        href="/path"
        className="mt-12 inline-block text-sm text-bedrock underline underline-offset-4 hover:text-ink"
      >
        {t.node.backToPath}
      </Link>
    </div>
  );
}

/** Подпись типа ошибки. Теги переведены — в отличие от прозы разбора. */
function tagLabel(tag: MisconceptionTag, locale: "kk" | "ru" | "en"): string {
  const labels: Record<MisconceptionTag, Record<string, string>> = {
    none: { kk: "—", ru: "—", en: "—" },
    conceptual: {
      kk: "тақырыпты түсінбеу",
      ru: "непонимание самой темы",
      en: "misunderstanding of the topic",
    },
    procedural: {
      kk: "тәртіпті бұзу",
      ru: "сбой в порядке действий",
      en: "a slip in the procedure",
    },
    careless: {
      kk: "абайсыздық",
      ru: "невнимательность, а не пробел",
      en: "carelessness, not a gap",
    },
    language_barrier: {
      kk: "шарттың тұжырымы",
      ru: "формулировка условия",
      en: "the wording of the task",
    },
    unknown: { kk: "белгісіз", ru: "не определено", en: "undetermined" },
  };
  return labels[tag][locale] ?? "";
}
