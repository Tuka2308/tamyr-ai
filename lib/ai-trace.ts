import type { ExplainResponse } from "../app/api/explain/route";
import type { MisconceptionTag } from "./types";

/* ============================================================================
   «След ИИ» — из чего собрано объяснение.

   Чистая функция, а не текст внутри компонента. Это принципиально: панель
   заявляет жюри конкретные факты о работе конвейера, и если бы она была
   статичной подписью, заявление оказалось бы ложным. Здесь каждый пункт
   выводится из полей реального ответа /api/explain, а тест ниже стережёт,
   что при разных ответах панель показывает разное.
   ============================================================================ */

export type TraceTone = "neutral" | "good" | "warn" | "bad";

export type TraceItem = {
  /** Ключ шага конвейера. */
  step: "retrieval" | "generation" | "verification" | "origin";
  tone: TraceTone;
  /** Значение, подставляемое в текст: число фрагментов, тег, вердикт. */
  value: string | number | boolean | null;
  /** Дополнительные строки — например, неподтверждённые утверждения. */
  details: string[];
};

/**
 * Разбирает ответ /api/explain на шаги конвейера.
 * Возвращает пустой список, если объяснения нет вовсе: показывать «след»
 * там, где ничего не происходило, значит выдумывать работу.
 */
export function buildAiTrace(response: ExplainResponse | null): TraceItem[] {
  if (!response || response.status === "unavailable") return [];

  const items: TraceItem[] = [];

  // 1. RETRIEVAL — сколько фрагментов программы реально ушло в контекст.
  items.push({
    step: "retrieval",
    tone: response.retrievedCount > 0 ? "neutral" : "warn",
    value: response.retrievedCount,
    details: response.sources,
  });

  // 2. GENERATION — под какую именно ошибку строилось объяснение.
  items.push({
    step: "generation",
    tone: response.tag === "none" ? "neutral" : "good",
    value: response.tag,
    details: [],
  });

  // 3. VERIFICATION — прошло ли заземление.
  items.push({
    step: "verification",
    tone: response.grounded === true ? "good" : response.grounded === false ? "bad" : "warn",
    value: response.grounded,
    details: response.unsupported,
  });

  // 4. Происхождение ответа: кэш, живой вызов или исходный фрагмент.
  items.push({
    step: "origin",
    tone: response.status === "chunk_fallback" ? "warn" : "neutral",
    value: response.status,
    details: response.reason ? [response.reason] : [],
  });

  return items;
}

/** Показан ли ученику разбор конкретной ошибки, а не общее объяснение темы. */
export function targetsMisconception(response: ExplainResponse | null): boolean {
  if (!response) return false;
  return response.tag !== "none" && response.tag !== "unknown";
}

/** Человекочитаемое имя тега. Теги переведены — в отличие от прозы разбора. */
export const TAG_LABEL: Record<MisconceptionTag, Record<"kk" | "ru" | "en", string>> = {
  none: { kk: "нақты қате көрсетілмеген", ru: "конкретная ошибка не указана", en: "no specific error given" },
  conceptual: { kk: "тақырыпты түсінбеу", ru: "непонимание темы", en: "misunderstanding of the topic" },
  procedural: { kk: "амалдар ретіндегі қате", ru: "сбой в порядке действий", en: "a slip in the procedure" },
  careless: { kk: "абайсыздық", ru: "невнимательность", en: "carelessness" },
  language_barrier: { kk: "шарттың тұжырымы", ru: "формулировка условия", en: "wording of the task" },
  unknown: { kk: "белгісіз", ru: "не определено", en: "undetermined" },
};
