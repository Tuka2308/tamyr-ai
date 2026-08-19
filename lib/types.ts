/**
 * TAMYR AI — доменные типы.
 * Схемы зафиксированы в день 1; сами данные questions/chunks/students — день 2.
 */

export const LOCALES = ["kk", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
/** kk первым — это дефолт продукта, а не порядок в алфавите. */
export const DEFAULT_LOCALE: Locale = "kk";

/** Локализованная строка. Все три языка обязательны с первого дня. */
export type LocalizedText = Record<Locale, string>;

export type Grade = 5 | 6 | 7 | 8;
export const GRADES: readonly Grade[] = [5, 6, 7, 8] as const;

export type Subject = "math";

/** Узел графа предпосылок. `centrality` считается в коде, в JSON её нет. */
export type Node = {
  id: string;
  grade: Grade;
  subject: Subject;
  title: LocalizedText;
  prerequisites: string[];
  /** Доля потомков узла от числа узлов выше по программе. Заполняется loadGraph(). */
  centrality?: number;
};

/** Файл /data/graph.json */
export type GraphFile = {
  version: string;
  subject: Subject;
  nodes: Node[];
};

/** Задание. Минимум 3 на узел, у каждого дистрактора — разбор. */
export type Question = {
  id: string;
  nodeId: string;
  text: LocalizedText;
  options: string[];
  correctIndex: number;
  /**
   * Что означает выбор каждого варианта, человеческим языком (ru).
   * Длина совпадает с options; для correctIndex — пустая строка.
   * Идёт в /api/explain как предмет разбора.
   */
  misconception: string[];
  /**
   * Машиночитаемый тег для каждого варианта, параллельно misconception.
   * Без него день 3 не сможет отличить невнимательность от пробела,
   * имея на руках только прозу. Для correctIndex — "none".
   */
  misconceptionTags?: MisconceptionTag[];
  /**
   * Пара для классификатора языкового барьера: одно и то же умение
   * в длинной и краткой формулировке.
   */
  phrasing?: "long" | "short";
  pairId?: string;
};

/** Чанк учебной программы для RAG (/api/explain, день 5). */
export type CurriculumChunk = {
  id: string;
  nodeId: string;
  lang: Locale;
  text: string;
  /** Ссылка на раздел программы — показывается как маркер источника. */
  source: string;
};

/** Одна зафиксированная ошибка ученика — история для тепловой карты и разбора. */
export type StudentError = {
  nodeId: string;
  questionId: string;
  /** Какой вариант выбран. */
  chosenIndex: number;
  tag: MisconceptionTag;
};

/** Seed-ученик для тепловой карты учителя (день 6). */
export type Student = {
  id: string;
  name: string;
  grade: Grade;
  locale: Locale;
  /** id корневого узла, найденного диагностикой. */
  rootNodeId: string;
  /** Узел, с которого стартовала диагностика. */
  targetNodeId: string;
  /** Узлы, которыми ученик владеет уверенно. */
  masteredNodeIds: string[];
  gdi: number;
  /** Разбивка D/B/C — учитель видит, из чего сложился индекс. */
  gdiInputs: GdiInputs;
  /** История ошибок: что выбрал и почему это неверно. */
  errors: StudentError[];
  questionsAsked: number;
  /** ISO-дата прохождения диагностики. */
  diagnosedAt: string;
};

/* --- Диагностика ------------------------------------------------ */

/**
 * Тип ошибки. `careless` отделён от `conceptual` намеренно: арифметическая
 * невнимательность НЕ является пробелом и не должна опускать ученика по графу.
 */
export type MisconceptionTag =
  | "none"
  | "language_barrier"
  | "procedural"
  | "conceptual"
  | "careless"
  | "unknown";

/**
 * Сила свидетельства о владении узлом.
 * `verified`    — узел проверен двумя заданиями подряд (полное правило).
 * `single_item` — у узла всего одно задание, второго подтверждения взять негде.
 * Это различие обязано быть видно в UI: узел с `single_item` рисуется
 * пунктиром, а не сплошной обводкой. Прятать слабое свидетельство нельзя.
 */
export type MasteryConfidence = "verified" | "single_item";

/**
 * Вердикт классификатора языкового барьера. ТРЁХзначный, не булев.
 * `not_assessed` означает «проверить было нечем» (у узла нет парного задания)
 * и НИКОГДА не должен трактоваться как `not_detected` — это разные вещи,
 * и их смешение испортит метрику дня 6.
 */
export type LanguageBarrierVerdict = "detected" | "not_detected" | "not_assessed";

/** Что делал алгоритм в момент шага — нужно дню 4 для разной отрисовки. */
export type DiagnosisPhase =
  /** Проверка целевого узла, с которого стартовали. */
  | "target"
  /** Бинарный поиск по цепочке предпосылок. */
  | "descent"
  /** Проверка, не в формулировке ли условия дело. */
  | "language_check"
  /**
   * Уточняющий проход: прямая проверка предпосылок кандидата в корень.
   * Нужен потому, что бинарный поиск по неоднородной цепочке может
   * остановиться на узел выше настоящего корня.
   */
  | "boundary"
  | "done";

/** Почему диагностика остановилась. */
export type StopReason =
  /** Интервал бинарного поиска схлопнулся — корень найден честно. */
  | "root_found"
  /** Исчерпан лимит в 15 вопросов, корень — лучшая оценка. */
  | "limit_reached"
  /** Ученик владеет целевым узлом, спускаться не от чего. */
  | "target_mastered";

/** Один шаг спуска по графу — показывается в UI как «путь диагностики». */
export type Step = {
  index: number;
  nodeId: string;
  questionId: string;
  /** Выбранный вариант; null — пропуск. */
  answerIndex: number | null;
  correct: boolean;
  /** Решение алгоритма после ответа. */
  decision: "mastered" | "not_mastered" | "continue";
  /** Узел был кандидатом в корень и уточняющий проход опустил его ниже. */
  demotedCandidate?: string;
  /** Интервал бинарного поиска до и после шага — ядро объяснимости. */
  intervalBefore: [number, number];
  intervalAfter: [number, number];
  /** Тег выбранного варианта, НЕ проза: прозу день 4 не показывает. */
  misconception: MisconceptionTag;
  /** Фаза алгоритма — целевой узел, спуск или проверка формулировки. */
  phase: DiagnosisPhase;
  /** Позиция узла в цепочке предпосылок; null для целевого узла. */
  chainIndex: number | null;
  /** Сила свидетельства по узлу на момент шага. */
  confidence: MasteryConfidence;
};

/** Слагаемые индекса ИГП: (D + B + C) / 3. */
export type GdiInputs = {
  /** Глубина: (класс_ученика − класс_корня) / 5, срезано на 1. */
  depth: number;
  /** Широта: не_освоено_на_текущем_уровне / всего_узлов_уровня. */
  breadth: number;
  /** Блокирующая центральность: |потомки(корень)| / |узлы выше по программе|. */
  centrality: number;
};

export type GdiBand = "none" | "local" | "deep" | "systemic";

export type DiagnosisResult = {
  /** Найденный корневой пробел. */
  root: Node;
  /** Узел, с которого стартовала диагностика. */
  target: Node;
  /** Цепочка предпосылок, по которой шёл бинарный поиск, от фундамента к цели. */
  chain: string[];
  igpInputs: GdiInputs;
  gdi: number;
  steps: Step[];
  questionsAsked: number;
  /** Почему остановились. */
  stopReason: StopReason;
  /** true, если лимит в 15 вопросов исчерпан и корень — лучшая оценка. */
  truncated: boolean;
  /** Сила свидетельства по найденному корню. */
  confidence: MasteryConfidence;
  /**
   * Кандидат, к которому сошёлся бинарный поиск ДО уточняющего прохода.
   * Совпадает с root, если уточнение ничего не изменило. Показываем разницу
   * на экране: это прямое доказательство, что мы не остановились на «попроще».
   */
  candidateBeforeRefinement: string;
  /** Сколько узлов уточняющий проход добавил к спуску. */
  refinementDepth: number;
  /** Агрегированный вердикт по языковому барьеру за всю сессию. */
  languageBarrier: LanguageBarrierVerdict;
  /** Узлы, которыми ученик владеет — вход формулы ИГП и карты графа. */
  masteredNodeIds: string[];
  /** Куда вести дальше: первый узел над корнем. null, если корень — цель. */
  nextNodeId: string | null;
};

/** Профиль из онбординга. */
export type Profile = {
  grade: Grade;
  subject: Subject;
  goal: "ent" | "school" | "catchup";
  locale: Locale;
};
