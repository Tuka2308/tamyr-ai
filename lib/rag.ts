import { chunksForNode, questionsForNode } from "./data";
import { loadGraph } from "./graph";
import type { CurriculumChunk, Locale, MisconceptionTag } from "./types";

/* ============================================================================
   RAG-конвейер для /api/explain. Три прохода:

     1. RETRIEVAL     — отбор чанков по nodeId + лексическое ранжирование
     2. GENERATION    — только факты из переданных чанков
     3. VERIFICATION  — второй вызов проверяет заземление каждого утверждения

   Почему заземление, а не «модель получше». Казахский — low-resource язык:
   по данным Information (MDPI, 16(11):943, 2025) KazLLM-8B closed-book даёт
   answer correctness 0,427, с идеальным контекстом — 0,867. Разрыв закрывает
   retrieval, а не выбор модели. Поэтому verification-проход не украшение:
   без него мы отдаём школьнику текст, который может быть выдуман.
   ============================================================================ */

export const EXPLAIN_MODEL = "claude-opus-5";

/** Сколько чанков уходит в контекст генерации. */
const TOP_K = 4;

export type RetrievalResult = {
  chunks: CurriculumChunk[];
  /** Язык найденных чанков. Может не совпадать с языком пользователя. */
  sourceLang: Locale | null;
  /** true, если пришлось откатиться на русские чанки. */
  languageFallback: boolean;
};

/* --- Проход 1: RETRIEVAL -------------------------------------------------- */

/** Слова длиннее двух символов, в нижнем регистре. Кириллица учитывается. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Лексическое ранжирование: доля слов запроса, встретившихся в чанке.
 * Векторный поиск на 5–6 чанках на узел избыточен — он добавил бы зависимость
 * и модель эмбеддингов ради задачи, которую решает пересечение множеств.
 */
function score(chunk: CurriculumChunk, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const chunkTokens = new Set(tokenize(chunk.text));
  const hits = queryTokens.filter((token) => chunkTokens.has(token)).length;
  return hits / queryTokens.length;
}

export function retrieve(
  nodeId: string,
  locale: Locale,
  query: string,
): RetrievalResult {
  const inLocale = chunksForNode(nodeId, locale);
  if (inLocale.length === 0) {
    return { chunks: [], sourceLang: null, languageFallback: false };
  }

  const sourceLang = inLocale[0]!.lang;
  const queryTokens = tokenize(query);

  const ranked = [...inLocale]
    .map((chunk) => ({ chunk, s: score(chunk, queryTokens) }))
    // Стабильная сортировка: при равном скоре сохраняем порядок программы.
    .sort((a, b) => b.s - a.s)
    .slice(0, TOP_K)
    .map((r) => r.chunk);

  return {
    chunks: ranked,
    sourceLang,
    languageFallback: sourceLang !== locale,
  };
}

/* --- Проход 2: GENERATION ------------------------------------------------- */

const LANG_NAME: Record<Locale, string> = {
  kk: "казахском",
  ru: "русском",
  en: "английском",
};

export function buildGenerationSystemPrompt(input: {
  locale: Locale;
  nodeGrade: number;
  nodeTitle: string;
}): string {
  return [
    "Ты объясняешь школьнику одну тему по математике.",
    "",
    "ЖЁСТКИЕ ПРАВИЛА:",
    "1. Опирайся ТОЛЬКО на факты из переданных фрагментов учебной программы.",
    "   Ничего не додумывай и не добавляй из общих знаний.",
    "2. Если переданных фрагментов не хватает, чтобы ответить, скажи об этом",
    "   прямо одной фразой. Не заполняй пробел догадкой.",
    `3. Отвечай на ${LANG_NAME[input.locale]} языке.`,
    `4. Объясняй на уровне ${input.nodeGrade} класса — это класс самой темы,`,
    "   а не класс ученика. Ученик пришёл сюда именно потому, что тема",
    "   предыдущих лет не закрыта; сложные слова его оттолкнут.",
    "5. Не более 120 слов. Без приветствий и без похвалы.",
    "6. Разбери конкретную ошибку ученика, если она указана: объясни, почему",
    "   такой ход рассуждения не работает, и как рассуждать верно.",
    "",
    `Тема: «${input.nodeTitle}», ${input.nodeGrade} класс.`,
  ].join("\n");
}

export function buildGenerationUserPrompt(input: {
  chunks: CurriculumChunk[];
  misconceptionProse: string | null;
}): string {
  const fragments = input.chunks
    .map((c, i) => `[${i + 1}] Источник: ${c.source}\n${c.text}`)
    .join("\n\n");

  const task = input.misconceptionProse
    ? `Ошибка ученика: ${input.misconceptionProse}\n\nОбъясни, почему так рассуждать нельзя, и как правильно.`
    : "Объясни тему кратко и по существу.";

  return `Фрагменты учебной программы:\n\n${fragments}\n\n---\n\n${task}`;
}

/* --- Проход 3: VERIFICATION ----------------------------------------------- */

export type Verification = { grounded: boolean; unsupported: string[] };

export const VERIFICATION_SYSTEM_PROMPT = [
  "Ты проверяешь, опирается ли объяснение на переданные фрагменты программы.",
  "",
  "Разбей объяснение на отдельные утверждения. Для каждого проверь, следует",
  "ли оно из фрагментов. Утверждение считается неподтверждённым, если оно",
  "вводит факт, правило, число или пример, которых во фрагментах нет.",
  "",
  "Переформулировки и упрощения подтверждёнными считаются — важна суть,",
  "а не совпадение слов. Общие связки («давай разберём», «итак») не являются",
  "утверждениями и не проверяются.",
  "",
  "grounded = true только если неподтверждённых утверждений нет.",
  "В unsupported перечисли неподтверждённые утверждения дословно.",
].join("\n");

/** JSON-схема ответа верификатора — структурированный вывод, не парсинг текста. */
export const VERIFICATION_SCHEMA = {
  type: "object" as const,
  properties: {
    grounded: { type: "boolean" as const },
    unsupported: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["grounded", "unsupported"],
  additionalProperties: false,
};

export function buildVerificationUserPrompt(input: {
  chunks: CurriculumChunk[];
  explanation: string;
}): string {
  const fragments = input.chunks
    .map((c, i) => `[${i + 1}] ${c.text}`)
    .join("\n\n");

  return `Фрагменты:\n\n${fragments}\n\n---\n\nОбъяснение для проверки:\n\n${input.explanation}`;
}

/* --- Ключ кэша ------------------------------------------------------------ */

/**
 * Кэш адресуется тройкой «узел + тег ошибки + язык». Прозу misconception
 * в ключ не берём: она различается между заданиями одного узла, а объяснение
 * типа ошибки — общее. Иначе кэш пришлось бы держать на каждое задание.
 */
export function cacheKey(nodeId: string, tag: MisconceptionTag, locale: Locale): string {
  return `${nodeId}::${tag}::${locale}`;
}

/** Проза разбора по тегу — первый попавшийся дистрактор с этим тегом. */
export function misconceptionProseFor(nodeId: string, tag: MisconceptionTag): string | null {
  if (tag === "none" || tag === "unknown") return null;

  for (const question of questionsForNode(nodeId)) {
    const index = question.misconceptionTags?.indexOf(tag) ?? -1;
    if (index >= 0 && index !== question.correctIndex) {
      return question.misconception[index] ?? null;
    }
  }
  return null;
}

/** Есть ли вообще материал по узлу. Если нет — честная заглушка, не генерация. */
export function hasCurriculum(nodeId: string): boolean {
  const graph = loadGraph();
  if (!graph.byId.has(nodeId)) return false;
  return chunksForNode(nodeId, "ru").length > 0;
}
