"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { loadGraph } from "@/lib/graph";
import {
  addTeacherQuestion,
  buildQuestion,
  loadTeacherQuestions,
  removeTeacherQuestion,
  toRepositoryJson,
  validateInput,
  type TeacherQuestion,
} from "@/lib/teacher-store";
import type { MisconceptionTag } from "@/lib/types";

const graph = loadGraph();
const TAGS: MisconceptionTag[] = ["conceptual", "procedural", "careless"];
const OPTION_COUNT = 4;

/**
 * Добавление задания учителем.
 *
 * Задание правда сохраняется и правда появляется на странице узла — это
 * работающая функция, а не макет. Рядом кнопка «Показать JSON»: она выводит
 * структуру, которая ушла бы в data/questions.json при коммите, чтобы на
 * защите было видно, что именно попадает в данные.
 */
export function AddQuestionForm() {
  const { locale, t } = useLocale();

  const [nodeId, setNodeId] = useState("frac_operations");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<string[]>(Array(OPTION_COUNT).fill(""));
  const [correctIndex, setCorrectIndex] = useState(0);
  const [misconceptions, setMisconceptions] = useState<string[]>(Array(OPTION_COUNT).fill(""));
  const [tags, setTags] = useState<MisconceptionTag[]>(Array(OPTION_COUNT).fill("conceptual"));
  const [added, setAdded] = useState<TeacherQuestion[]>([]);
  const [showJsonFor, setShowJsonFor] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => setAdded(loadTeacherQuestions()), []);

  const patch = <T,>(list: T[], index: number, value: T): T[] =>
    list.map((item, i) => (i === index ? value : item));

  const submit = () => {
    const input = { nodeId, text, locale, options, correctIndex, misconceptions, tags };
    if (validateInput(input).length > 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setAdded(addTeacherQuestion(buildQuestion(input)));
    setText("");
    setOptions(Array(OPTION_COUNT).fill(""));
    setMisconceptions(Array(OPTION_COUNT).fill(""));
    setCorrectIndex(0);
  };

  return (
    <section>
      <h2 className="font-display text-sm font-semibold">{t.teacher.formTitle}</h2>
      <p className="mt-1 max-w-2xl text-xs text-bedrock">{t.teacher.formHint}</p>

      <div className="mt-5 space-y-4 rounded-xl border border-bedrock/20 p-4">
        <label className="block">
          <span className="text-xs font-medium text-bedrock">{t.teacher.formNode}</span>
          <select
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-bedrock/25 bg-white px-3 py-2 text-sm"
          >
            {graph.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.grade} · {node.title[locale]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-bedrock">{t.teacher.formText}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border-2 border-bedrock/25 bg-white px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-bedrock">{t.teacher.formOption}</legend>
          {options.map((option, i) => (
            <div key={i} className="rounded-lg border border-bedrock/20 p-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                  aria-label={`${t.teacher.formCorrect} ${String.fromCharCode(65 + i)}`}
                  className="h-4 w-4 shrink-0 accent-[var(--color-spring)]"
                />
                <span className="w-4 shrink-0 font-display text-xs text-bedrock">
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  value={option}
                  onChange={(e) => setOptions(patch(options, i, e.target.value))}
                  className="min-w-0 flex-1 rounded border-2 border-bedrock/25 bg-white px-2 py-1.5 text-sm"
                />
              </div>

              {/* Разбор нужен только у неверных вариантов. */}
              {correctIndex !== i && (
                <div className="mt-2 flex flex-col gap-2 pl-10 sm:flex-row">
                  <input
                    value={misconceptions[i] ?? ""}
                    onChange={(e) => setMisconceptions(patch(misconceptions, i, e.target.value))}
                    placeholder={t.teacher.formMisconception}
                    className="min-w-0 flex-1 rounded border border-bedrock/25 bg-white px-2 py-1.5 text-xs"
                  />
                  <select
                    value={tags[i]}
                    onChange={(e) => setTags(patch(tags, i, e.target.value as MisconceptionTag))}
                    aria-label={t.teacher.formTag}
                    className="shrink-0 rounded border border-bedrock/25 bg-white px-2 py-1.5 text-xs"
                  >
                    {TAGS.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </fieldset>

        {invalid && <p className="text-xs text-root">{t.teacher.formErrors}</p>}

        <button
          type="button"
          onClick={submit}
          className="rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-chalk"
        >
          {t.teacher.formAdd}
        </button>
      </div>

      {added.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-xs font-semibold">
            {t.teacher.formAdded} ({added.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {added.map((question) => (
              <li key={question.id} className="rounded-lg border border-vein/50 bg-vein/5 p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{question.text[locale]}</p>
                    <p className="mt-1 text-xs text-bedrock">
                      {graph.byId.get(question.nodeId)?.title[locale]}
                      <span className="ml-2 rounded bg-vein/25 px-1.5 py-0.5 text-[0.65rem] text-ink">
                        {t.teacher.addedBadge}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setShowJsonFor(showJsonFor === question.id ? null : question.id)
                    }
                    aria-expanded={showJsonFor === question.id}
                    className="text-xs text-bedrock underline underline-offset-4 hover:text-ink"
                  >
                    {showJsonFor === question.id ? t.teacher.formHideJson : t.teacher.formShowJson}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdded(removeTeacherQuestion(question.id))}
                    className="text-xs text-root underline underline-offset-4"
                  >
                    {t.teacher.formRemove}
                  </button>
                </div>

                {showJsonFor === question.id && (
                  <div className="mt-3">
                    <p className="text-[0.7rem] text-bedrock">{t.teacher.formJsonHint}</p>
                    <pre className="mt-1.5 max-h-72 overflow-auto rounded-lg bg-ink p-3 text-[0.7rem] leading-relaxed text-chalk">
                      {toRepositoryJson(question)}
                    </pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
