import { pairedQuestion, questionsForNode } from "./data";
import { computeGdi, computeGdiInputs, inferMasteredNodeIds } from "./gdi";
import { buildPrereqChain, loadGraph, type Graph } from "./graph";
import type {
  DiagnosisPhase,
  DiagnosisResult,
  Grade,
  LanguageBarrierVerdict,
  MasteryConfidence,
  MisconceptionTag,
  Question,
  Step,
  StopReason,
} from "./types";

/* ============================================================================
   ЯДРО ПРОДУКТА: поиск корневого пробела.

   Здесь нет обращений к LLM и не может быть. Маршрут ученика определяется
   детерминированным алгоритмом — это то, что отличает TAMYR от чат-бота:
   один и тот же набор ответов всегда даёт один и тот же корень, и каждый шаг
   можно предъявить и объяснить. LLM появляется только на дне 5 и только для
   объяснения уже выбранного узла.

   Как это работает по шагам:

   1. Проверяем целевой узел (тот, где ученик «застрял» по своей оценке).
      Если владеет — спускаться не от чего, вести надо вверх.

   2. Строим цепочку всех транзитивных предпосылок цели, топологически
      упорядоченную от фундамента к цели.

   3. Бинарный поиск по цепочке. Владеет серединой — корень выше, поднимаем lo.
      Не владеет — корень ниже, опускаем hi.

   4. УТОЧНЯЮЩИЙ ПРОХОД. Кандидата, к которому сошёлся бинарный поиск, мы НЕ
      возвращаем сразу. Сначала проверяем напрямую его непосредственные
      предпосылки. Если хоть одна не освоена — настоящий корень ниже, кандидат
      сменяется, проверка повторяется. Подробнее — над функцией enterBoundary.

   ПОЧЕМУ ШАГ 4 ОБЯЗАТЕЛЕН.
   Бинарный поиск корректен, когда предикат «владеет узлом» монотонен вдоль
   цепочки: владеет позицией i ⇒ владеет всем до i. Топологический порядок
   этого НЕ гарантирует — цепочка перемежает независимые ветви программы.
   В цепочке quadratic_equations узел powers_natural стоит на позиции 3, выше
   корня fractions_basic на позиции 2, но принадлежит другой ветви и остаётся
   освоенным. На таких участках поиск останавливается на узел выше настоящего
   корня. Замер дня 3 без уточняющего прохода: Root Hit Rate 8 из 10, оба
   промаха — ровно на одно ребро выше истинного корня.

   Для продукта, который обещает найти НАСТОЯЩИЙ корень, а не тот, что выше
   и удобнее, промах на одно ребро — это промах по существу. Поэтому шаг 4
   не косметика, а исправление. Он не переписывает бинарный поиск: тот
   по-прежнему за логарифм сужает область до кандидата, а уточнение
   достраивает последнюю милю по фактическим рёбрам графа.

   Реализация — чистый редьюсер (startDiagnosis / submitAnswer), а не функция
   с колбэком. Причина практическая: день 4 показывает вопросы по одному и ждёт
   ответа пользователя, то есть управление принадлежит UI, а не алгоритму.
   Редьюсер сериализуем, воспроизводим и одинаково хорошо крутится как в React,
   так и в тестовом цикле. Функция diagnose() ниже — тонкая обёртка над ним
   с сигнатурой из исходной спецификации.
   ============================================================================ */

/** Жёсткий потолок. Диагностика, которая не кончается, не будет пройдена до конца. */
export const QUESTION_LIMIT = 15;

/** Сколько верных ответов подряд считаем владением, когда заданий хватает. */
const MASTERY_STREAK = 2;

/** Предохранитель от бесконечного спуска. Граф ацикличен, но глубина конечна. */
const MAX_REFINEMENT_DEPTH = 8;

/* --- Состояние ------------------------------------------------------------ */

/** Что именно проверяет текущая проба — от этого зависит переход после ответа. */
type ProbeRole = "target" | "chain" | "boundary";

/**
 * Проверка одного узла. Живёт, пока не наберётся достаточно свидетельств
 * либо не случится первая ошибка.
 */
type NodeProbe = {
  nodeId: string;
  role: ProbeRole;
  /** Позиция в цепочке; null — узел вне цепочки (цель или уточняющий проход). */
  chainIndex: number | null;
  /** Задания, которые ещё можно задать по этому узлу. */
  queue: string[];
  /** Сколько верных ответов подряд уже получено. */
  streak: number;
  /**
   * Сколько верных подряд требуется. Адаптивный критерий владения:
   *
   *   ≥2 задания на узле → 2 верных подряд, confidence = "verified"
   *    1 задание на узле → 1 верный ответ,  confidence = "single_item"
   *
   * Второй случай — не поблажка, а честное признание границы данных: 52 узла
   * из 75 имеют по одному заданию, и второго независимого подтверждения там
   * взять неоткуда. Мы не делаем вид, что свидетельство равносильно, —
   * мы помечаем его как слабое и показываем это в интерфейсе.
   */
  required: number;
  confidence: MasteryConfidence;
};

/** Измеренный вердикт по узлу. Только по факту ответов, без домыслов. */
export type NodeVerdict = { mastered: boolean; confidence: MasteryConfidence };

/** Полное состояние сессии. Сериализуемо — можно положить в localStorage. */
export type DiagnosisState = {
  targetNodeId: string;
  studentGrade: Grade;
  /** Цепочка предпосылок от фундамента к цели, без самой цели. */
  chain: string[];
  phase: DiagnosisPhase;
  /** Границы интервала бинарного поиска. */
  lo: number;
  hi: number;
  /** Самая глубокая позиция в цепочке, владение которой подтверждено. −1 — ничего. */
  deepestMastered: number;
  /** Сила свидетельства по самому глубокому подтверждённому узлу. */
  deepestConfidence: MasteryConfidence;
  /**
   * Вердикты по узлам, полученные ИЗМЕРЕНИЕМ, а не выводом из монотонности.
   * Именно поэтому уточняющий проход может опровергнуть бинарный поиск:
   * он опирается на факты, а не на допущение о порядке цепочки.
   */
  nodeVerdicts: Record<string, NodeVerdict>;
  probe: NodeProbe | null;
  /** Вопрос, который сейчас показан ученику. null — сессия завершена. */
  currentQuestionId: string | null;
  askedQuestionIds: string[];
  questionsAsked: number;
  steps: Step[];
  /** Вердикты по языковому барьеру, накопленные по узлам. */
  languageVerdicts: LanguageBarrierVerdict[];
  /** Проверка формулировки: проба, к которой надо вернуться с результатом. */
  languageCheck: { probe: NodeProbe; failedQuestionId: string } | null;
  /** Состояние уточняющего прохода. */
  boundary: {
    /** Текущий кандидат в корень. */
    candidate: string;
    /** Кандидат, к которому сошёлся бинарный поиск, — до всякого уточнения. */
    initialCandidate: string;
    /** Непроверенные прямые предпосылки кандидата. */
    queue: string[];
    /** Сколько раз кандидат опускался ниже. */
    depth: number;
  } | null;
  result: DiagnosisResult | null;
};

export type DiagnosisOptions = {
  /**
   * Класс ученика — нужен для компоненты «глубина» в ИГП.
   * По умолчанию равен классу целевого узла.
   */
  studentGrade?: Grade;
  graph?: Graph;
  /**
   * Потолок числа вопросов. По умолчанию QUESTION_LIMIT = 15.
   * Параметризован, чтобы ветку limit_reached было чем покрыть: на штатном
   * лимите она недостижима, и bestCurrentEstimate остался бы кодом без тестов.
   */
  questionLimit?: number;
  /**
   * Отключает уточняющий проход. Нужен ровно для одного: замерить метрики
   * «до» и «после» на одних и тех же профилях (docs/preregistration.md).
   * В проде всегда включён.
   */
  skipRefinement?: boolean;
};

/* --- Вспомогательное ------------------------------------------------------ */

/**
 * Готовит проверку узла: собирает задания и выбирает критерий владения.
 *
 * Порядок заданий важен для классификатора языкового барьера: длинные
 * формулировки идут первыми. Так и происходит в жизни — школьная задача
 * обычно многословна, — и именно на длинной формулировке ошибка может
 * означать не пробел в теме, а непонимание условия.
 */
function makeProbe(
  nodeId: string,
  role: ProbeRole,
  chainIndex: number | null,
  asked: Set<string>,
): NodeProbe | null {
  const pool = questionsForNode(nodeId).filter((q) => !asked.has(q.id));
  if (pool.length === 0) return null;

  const ordered = [...pool].sort((a, b) => {
    const weight = (q: Question) => (q.phrasing === "long" ? 0 : q.phrasing === "short" ? 2 : 1);
    return weight(a) - weight(b);
  });

  // Критерий считаем по ВСЕМУ фонду узла, а не по остатку: если у узла
  // два задания и одно уже задано выше по спуску, свидетельство от этого
  // не становится слабее — просто мы не задаём вопрос дважды.
  const total = questionsForNode(nodeId).length;
  const required = total >= 2 ? Math.min(MASTERY_STREAK, ordered.length) : 1;

  return {
    nodeId,
    role,
    chainIndex,
    queue: ordered.map((q) => q.id),
    streak: 0,
    required,
    confidence: required >= MASTERY_STREAK ? "verified" : "single_item",
  };
}

/** Тег выбранного варианта. Прозу разбора сюда не тянем — она только для дня 5. */
function tagFor(question: Question, answerIndex: number | null): MisconceptionTag {
  if (answerIndex === null) return "unknown";
  if (answerIndex === question.correctIndex) return "none";
  return question.misconceptionTags?.[answerIndex] ?? "unknown";
}

/**
 * Агрегирует вердикты по узлам в один вердикт за сессию.
 *
 * Правило приоритета намеренно асимметрично: одного обнаружения достаточно,
 * чтобы сказать «барьер есть», но отсутствие обнаружений само по себе НЕ даёт
 * права сказать «барьера нет». Если ни один узел не удалось проверить, вердикт
 * остаётся not_assessed. Схлопывание «не проверяли» в «не нашли» — самый
 * простой способ незаметно завысить метрику, и мы его закрываем здесь.
 */
function aggregateLanguageVerdict(verdicts: LanguageBarrierVerdict[]): LanguageBarrierVerdict {
  if (verdicts.includes("detected")) return "detected";
  if (verdicts.includes("not_detected")) return "not_detected";
  return "not_assessed";
}

/**
 * Записывает в последний шаг интервал, каким он стал ПОСЛЕ решения алгоритма.
 *
 * Шаг попадает в историю в момент ответа, когда границы ещё не сдвинуты, —
 * иначе пришлось бы предсказывать решение до его принятия. Без этой дописки
 * intervalAfter дублировал бы intervalBefore, и «путь диагностики» на экране
 * не показывал бы главного: как именно ответ сузил область поиска.
 */
function sealLastStep(state: DiagnosisState, extra?: Partial<Step>): DiagnosisState {
  if (state.steps.length === 0) return state;
  const steps = [...state.steps];
  const last = steps[steps.length - 1]!;
  steps[steps.length - 1] = { ...last, intervalAfter: [state.lo, state.hi], ...extra };
  return { ...state, steps };
}

/** Фиксирует измеренный вердикт по узлу. */
function recordVerdict(state: DiagnosisState, probe: NodeProbe, mastered: boolean): DiagnosisState {
  return {
    ...state,
    nodeVerdicts: {
      ...state.nodeVerdicts,
      [probe.nodeId]: { mastered, confidence: probe.confidence },
    },
  };
}

/* --- Запуск --------------------------------------------------------------- */

export function startDiagnosis(targetNodeId: string, options: DiagnosisOptions = {}): DiagnosisState {
  const graph = options.graph ?? loadGraph();
  const target = graph.byId.get(targetNodeId);
  if (!target) throw new Error(`Диагностика: узла «${targetNodeId}» нет в графе`);

  const chain = buildPrereqChain(graph, targetNodeId);
  const probe = makeProbe(targetNodeId, "target", null, new Set());
  if (!probe) throw new Error(`Диагностика: у узла «${targetNodeId}» нет заданий`);

  return {
    targetNodeId,
    studentGrade: options.studentGrade ?? target.grade,
    chain,
    phase: "target",
    // Интервал поиска — весь диапазон цепочки. Он схлопывается по мере ответов,
    // и именно его день 4 рисует вертикальной скобкой, скользящей по пласту.
    lo: 0,
    hi: chain.length - 1,
    deepestMastered: -1,
    deepestConfidence: "verified",
    nodeVerdicts: {},
    probe,
    currentQuestionId: probe.queue[0] ?? null,
    askedQuestionIds: [],
    questionsAsked: 0,
    steps: [],
    languageVerdicts: [],
    languageCheck: null,
    boundary: null,
    result: null,
  };
}

/* --- Шаг ------------------------------------------------------------------ */

/**
 * Обрабатывает один ответ и возвращает НОВОЕ состояние.
 * answerIndex === null означает пропуск вопроса и засчитывается как ошибка:
 * пропуск — это тоже отсутствие подтверждения владения.
 */
export function submitAnswer(
  state: DiagnosisState,
  answerIndex: number | null,
  options: DiagnosisOptions = {},
): DiagnosisState {
  if (state.result || !state.currentQuestionId || !state.probe) return state;

  const graph = options.graph ?? loadGraph();
  const limit = options.questionLimit ?? QUESTION_LIMIT;
  const question = questionsForNode(state.probe.nodeId).find((q) => q.id === state.currentQuestionId);
  if (!question) throw new Error(`Диагностика: задание «${state.currentQuestionId}» не найдено`);

  const correct = answerIndex !== null && answerIndex === question.correctIndex;
  const intervalBefore: [number, number] = [state.lo, state.hi];

  let next: DiagnosisState = {
    ...state,
    questionsAsked: state.questionsAsked + 1,
    askedQuestionIds: [...state.askedQuestionIds, question.id],
  };

  /* --- Ветка 1: это была проверка формулировки ---------------------------- */
  if (state.phase === "language_check" && state.languageCheck) {
    const { probe } = state.languageCheck;

    // Ошибся на длинной формулировке, но решил ту же задачу в краткой →
    // подвело условие, а не тема. Узел засчитывается как освоенный,
    // и вниз по графу мы НЕ идём: иначе поведём ученика лечить то,
    // что у него не сломано.
    const verdict: LanguageBarrierVerdict = correct ? "detected" : "not_detected";

    next = pushStep(next, {
      nodeId: probe.nodeId,
      question,
      answerIndex,
      correct,
      decision: correct ? "mastered" : "not_mastered",
      intervalBefore,
      phase: "language_check",
      chainIndex: probe.chainIndex,
      confidence: probe.confidence,
    });

    next.languageVerdicts = [...next.languageVerdicts, verdict];
    next.languageCheck = null;

    return resolveNode(next, probe, correct, graph, limit, options);
  }

  /* --- Ветка 2: обычный вопрос по узлу ------------------------------------ */
  const probe = state.probe;

  if (correct) {
    const streak = probe.streak + 1;
    const enough = streak >= probe.required;

    next = pushStep(next, {
      nodeId: probe.nodeId,
      question,
      answerIndex,
      correct: true,
      decision: enough ? "mastered" : "continue",
      intervalBefore,
      phase: state.phase,
      chainIndex: probe.chainIndex,
      confidence: probe.confidence,
    });

    if (!enough) {
      // Свидетельств пока мало — задаём следующий вопрос по тому же узлу.
      const queue = probe.queue.slice(1);
      next.probe = { ...probe, streak, queue };
      next.currentQuestionId = queue[0] ?? null;

      // Лимит проверяется и ЗДЕСЬ, а не только перед началом проверки узла.
      // Проверка узла стоит до двух вопросов, поэтому потолок, проверенный
      // лишь на входе, можно перешагнуть вторым вопросом пробы. Замер на
      // 554 профилях поймал ровно один такой случай: 16 вопросов при лимите 15.
      const outOfBudget = next.questionsAsked >= limit;

      // Задания кончились раньше, чем набрался стрик, либо кончился бюджет.
      // Довольствуемся тем, что есть, но честно понижаем силу свидетельства.
      if (!next.currentQuestionId || outOfBudget) {
        const weakened: NodeProbe = { ...probe, streak, confidence: "single_item" };
        return resolveNode(next, weakened, true, graph, limit, options);
      }
      return next;
    }

    return resolveNode(next, { ...probe, streak }, true, graph, limit, options);
  }

  /* --- Ошибка ------------------------------------------------------------- */

  // Прежде чем опускать ученика вниз по графу, проверяем, не в формулировке ли
  // дело. Условие срабатывания: ошибка случилась на длинной формулировке,
  // и у задания есть краткий парный вариант, который мы ещё не задавали.
  const partner = pairedQuestion(question);
  const canCheckLanguage =
    question.phrasing === "long" &&
    partner !== undefined &&
    !next.askedQuestionIds.includes(partner.id) &&
    next.questionsAsked < limit;

  next = pushStep(next, {
    nodeId: probe.nodeId,
    question,
    answerIndex,
    correct: false,
    decision: canCheckLanguage ? "continue" : "not_mastered",
    intervalBefore,
    phase: state.phase,
    chainIndex: probe.chainIndex,
    confidence: probe.confidence,
  });

  if (canCheckLanguage) {
    next.phase = "language_check";
    next.languageCheck = { probe, failedQuestionId: question.id };
    next.currentQuestionId = partner.id;
    next.probe = { ...probe, queue: [partner.id] };
    return next;
  }

  // Парной задачи нет — проверить формулировку было нечем.
  // Пишем именно not_assessed, а не not_detected.
  if (question.phrasing !== "long" || partner === undefined) {
    next.languageVerdicts = [...next.languageVerdicts, "not_assessed"];
  }

  return resolveNode(next, probe, false, graph, limit, options);
}

/* --- Переходы ------------------------------------------------------------- */

/**
 * Узел проверен. Решаем, что делать дальше: закончить, начать спуск,
 * сдвинуть границы бинарного поиска или продолжить уточняющий проход.
 */
function resolveNode(
  state: DiagnosisState,
  probe: NodeProbe,
  mastered: boolean,
  graph: Graph,
  limit: number,
  options: DiagnosisOptions,
): DiagnosisState {
  let next: DiagnosisState = recordVerdict(
    { ...state, probe: null, currentQuestionId: null },
    probe,
    mastered,
  );

  /* Уточняющий проход. */
  if (probe.role === "boundary") {
    return resolveBoundary(next, probe, mastered, graph, limit);
  }

  /* Целевой узел. */
  if (probe.role === "target") {
    if (mastered) {
      // Ученик владеет тем, на чём считал себя застрявшим. Пробела ниже нет,
      // корнем считаем сам целевой узел, а вести надо вверх по программе.
      return finish(next, probe.nodeId, probe.nodeId, "target_mastered", probe.confidence, graph);
    }
    if (next.chain.length === 0) {
      // Цель без предпосылок (узел-фундамент): она сама и есть корень.
      return finish(next, probe.nodeId, probe.nodeId, "root_found", probe.confidence, graph);
    }
    next.phase = "descent";
    return advance(sealLastStep(next), graph, limit, options);
  }

  /* Узел цепочки. */
  if (mastered) {
    // Владеет — значит корень выше. Запоминаем достижение и поднимаем нижнюю границу.
    if (probe.chainIndex! > next.deepestMastered) {
      next.deepestMastered = probe.chainIndex!;
      next.deepestConfidence = probe.confidence;
    }
    next.lo = probe.chainIndex! + 1;
  } else {
    // Не владеет — корень здесь или ниже. Опускаем верхнюю границу.
    next.hi = probe.chainIndex! - 1;
  }

  return advance(sealLastStep(next), graph, limit, options);
}

/**
 * Делает следующий ход бинарного поиска: либо задаёт вопрос по середине
 * интервала, либо передаёт кандидата уточняющему проходу.
 */
function advance(
  state: DiagnosisState,
  graph: Graph,
  limit: number,
  options: DiagnosisOptions,
): DiagnosisState {
  let next: DiagnosisState = { ...state };

  while (true) {
    // Лимит вопросов. Останавливаемся ДО того, как задать лишний.
    if (next.questionsAsked >= limit) {
      const rootId = bestCurrentEstimate(next);
      return finish(next, rootId, rootId, "limit_reached", next.deepestConfidence, graph);
    }

    // Интервал схлопнулся — бинарный поиск сделал своё дело.
    if (next.lo > next.hi) {
      const candidate = rootFromDeepestMastered(next);
      if (options.skipRefinement) {
        return finish(next, candidate, candidate, "root_found", next.deepestConfidence, graph);
      }
      return enterBoundary(next, candidate, graph, limit);
    }

    const mid = Math.floor((next.lo + next.hi) / 2);
    const nodeId = next.chain[mid]!;
    const probe = makeProbe(nodeId, "chain", mid, new Set(next.askedQuestionIds));

    if (!probe) {
      // Все задания узла уже заданы выше по спуску. Пропускаем его, сузив
      // интервал, — иначе получим бесконечный цикл на одном и том же mid.
      if (mid === next.lo) next.lo = mid + 1;
      else next.hi = mid - 1;
      continue;
    }

    next.probe = probe;
    next.currentQuestionId = probe.queue[0]!;
    next.phase = "descent";
    return next;
  }
}

/* --- Уточняющий проход ---------------------------------------------------- */

/**
 * Открывает уточняющий проход по кандидату.
 *
 * Логика простая и полностью опирается на фактические рёбра графа, а не на
 * порядок цепочки: узел является корнем ТОЛЬКО если все его непосредственные
 * предпосылки освоены. Если хоть одна не освоена, корень заведомо ниже,
 * и кандидатом становится она.
 *
 * Почему это чинит немонотонность. Бинарный поиск ошибается, когда сравнивает
 * узлы из разных ветвей программы, оказавшиеся рядом в топологическом порядке.
 * Уточняющий проход не сравнивает ничего: он идёт строго по рёбрам «A нужен
 * для B», где никакой неоднозначности порядка нет по определению.
 *
 * Стоимость ограничена: у узлов графа от 0 до 3 прямых предпосылок, и спуск
 * прекращается на первом узле, все предпосылки которого освоены.
 */
function enterBoundary(
  state: DiagnosisState,
  candidate: string,
  graph: Graph,
  limit: number,
): DiagnosisState {
  const next: DiagnosisState = {
    ...state,
    phase: "boundary",
    boundary: {
      candidate,
      initialCandidate: candidate,
      queue: pendingPrereqs(state, graph, candidate),
      depth: 0,
    },
  };
  return advanceBoundary(next, graph, limit);
}

/**
 * Прямые предпосылки узла, по которым ещё нет измеренного вердикта.
 * Узлы, уже проверенные в этой диагностике, повторно не спрашиваем.
 */
function pendingPrereqs(state: DiagnosisState, graph: Graph, nodeId: string): string[] {
  const prereqs = graph.byId.get(nodeId)?.prerequisites ?? [];
  return prereqs.filter((id) => state.nodeVerdicts[id] === undefined);
}

/** Задаёт следующий вопрос уточняющего прохода либо завершает диагностику. */
function advanceBoundary(state: DiagnosisState, graph: Graph, limit: number): DiagnosisState {
  let next: DiagnosisState = { ...state };

  while (next.boundary) {
    const { candidate, queue, depth } = next.boundary;

    // Бюджет исчерпан — отдаём текущего кандидата. Он уже не хуже того,
    // что дал бы бинарный поиск: уточнение только опускает корень ниже.
    if (next.questionsAsked >= limit) {
      return finish(next, candidate, next.boundary.initialCandidate, "limit_reached", verdictConfidence(next, candidate), graph);
    }

    // Все прямые предпосылки проверены и освоены — кандидат подтверждён.
    if (queue.length === 0) {
      const unmastered = (graph.byId.get(candidate)?.prerequisites ?? []).find(
        (id) => next.nodeVerdicts[id]?.mastered === false,
      );
      if (unmastered) {
        // Предпосылка была признана неосвоенной ещё в бинарном поиске —
        // спускаемся к ней, не тратя вопрос повторно.
        next = descendCandidate(next, graph, unmastered, depth);
        continue;
      }
      return finish(next, candidate, next.boundary.initialCandidate, "root_found", verdictConfidence(next, candidate), graph);
    }

    const [head, ...rest] = queue;
    const probe = makeProbe(head!, "boundary", null, new Set(next.askedQuestionIds));

    if (!probe) {
      // Заданий по этой предпосылке не осталось — проверить нечем, идём дальше.
      next.boundary = { ...next.boundary, queue: rest };
      continue;
    }

    next.boundary = { ...next.boundary, queue: rest };
    next.probe = probe;
    next.currentQuestionId = probe.queue[0]!;
    next.phase = "boundary";
    return next;
  }

  return next;
}

/** Обрабатывает результат проверки одной прямой предпосылки. */
function resolveBoundary(
  state: DiagnosisState,
  probe: NodeProbe,
  mastered: boolean,
  graph: Graph,
  limit: number,
): DiagnosisState {
  if (!state.boundary) return state;

  const sealed = sealLastStep(state);

  if (mastered) {
    // Предпосылка в порядке — проверяем следующую.
    return advanceBoundary(sealed, graph, limit);
  }

  // Предпосылка не освоена: настоящий корень ниже кандидата.
  const demoted = state.boundary.candidate;
  const withNote = sealLastStep(sealed, { demotedCandidate: demoted });
  return advanceBoundary(
    descendCandidate(withNote, graph, probe.nodeId, state.boundary.depth),
    graph,
    limit,
  );
}

/** Опускает кандидата на найденную неосвоенную предпосылку. */
function descendCandidate(
  state: DiagnosisState,
  graph: Graph,
  newCandidate: string,
  depth: number,
): DiagnosisState {
  if (!state.boundary) return state;
  if (depth >= MAX_REFINEMENT_DEPTH) {
    return { ...state, boundary: { ...state.boundary, queue: [] } };
  }
  return {
    ...state,
    boundary: {
      ...state.boundary,
      candidate: newCandidate,
      queue: pendingPrereqs(state, graph, newCandidate),
      depth: depth + 1,
    },
  };
}

function verdictConfidence(state: DiagnosisState, nodeId: string): MasteryConfidence {
  return state.nodeVerdicts[nodeId]?.confidence ?? state.deepestConfidence;
}

/* --- Завершение ----------------------------------------------------------- */

/**
 * Корень = первый узел НАД самым глубоким уверенно освоенным.
 * Если освоено вообще ничего — корень в самом основании цепочки.
 * Если освоена вся цепочка — значит сломан сам целевой узел.
 */
function rootFromDeepestMastered(state: DiagnosisState): string {
  const index = state.deepestMastered + 1;
  if (index >= state.chain.length) return state.targetNodeId;
  return state.chain[index]!;
}

/**
 * Лучшая оценка корня при исчерпании лимита вопросов.
 *
 * Смещение в сторону глубины выбрано сознательно. Ошибиться «слишком глубоко»
 * значит дать ученику повторить материал, который он и так знает: потеря
 * времени. Ошибиться «слишком мелко» значит начать лечить следствие, оставив
 * причину нетронутой, — то есть ровно та ошибка, ради устранения которой
 * продукт и существует.
 */
function bestCurrentEstimate(state: DiagnosisState): string {
  return rootFromDeepestMastered(state);
}

/** Собирает финальный результат: корень, ИГП, история шагов. */
function finish(
  state: DiagnosisState,
  rootNodeId: string,
  candidateBeforeRefinement: string,
  stopReason: StopReason,
  confidence: MasteryConfidence,
  graph: Graph,
): DiagnosisState {
  const root = graph.byId.get(rootNodeId);
  const target = graph.byId.get(state.targetNodeId);
  if (!root || !target) throw new Error("Диагностика: узел результата не найден в графе");

  // Освоенное выводим общей функцией из lib/gdi.ts — той же, которой
  // пользуется генератор seed-профилей. Своя копия логики здесь означала бы,
  // что живая диагностика и тепловая карта учителя показывают разные числа.
  const masteredNodeIds = inferMasteredNodeIds(graph, rootNodeId, state.studentGrade);

  const igpInputs = computeGdiInputs(graph, {
    studentGrade: state.studentGrade,
    rootNodeId,
    masteredNodeIds,
  });

  const dependents = graph.dependents.get(rootNodeId) ?? [];
  const nextNodeId =
    stopReason === "target_mastered"
      ? (dependents[0] ?? null)
      : (state.chain[state.chain.indexOf(rootNodeId) + 1] ?? dependents[0] ?? state.targetNodeId);

  return {
    ...state,
    phase: "done",
    probe: null,
    currentQuestionId: null,
    boundary: null,
    result: {
      root,
      target,
      chain: state.chain,
      igpInputs,
      gdi: Number(computeGdi(igpInputs).toFixed(3)),
      steps: state.steps,
      questionsAsked: state.questionsAsked,
      stopReason,
      truncated: stopReason === "limit_reached",
      confidence,
      candidateBeforeRefinement,
      refinementDepth: state.boundary?.depth ?? 0,
      languageBarrier: aggregateLanguageVerdict(state.languageVerdicts),
      masteredNodeIds,
      nextNodeId: nextNodeId === rootNodeId ? null : nextNodeId,
    },
  };
}

/** Дописывает шаг в историю. История — обязательный элемент демо, не отладка. */
function pushStep(
  state: DiagnosisState,
  input: {
    nodeId: string;
    question: Question;
    answerIndex: number | null;
    correct: boolean;
    decision: Step["decision"];
    intervalBefore: [number, number];
    phase: DiagnosisPhase;
    chainIndex: number | null;
    confidence: MasteryConfidence;
  },
): DiagnosisState {
  const step: Step = {
    index: state.steps.length,
    nodeId: input.nodeId,
    questionId: input.question.id,
    answerIndex: input.answerIndex,
    correct: input.correct,
    decision: input.decision,
    intervalBefore: input.intervalBefore,
    intervalAfter: input.intervalBefore,
    misconception: tagFor(input.question, input.answerIndex),
    phase: input.phase,
    chainIndex: input.chainIndex,
    confidence: input.confidence,
  };
  return { ...state, steps: [...state.steps, step] };
}

/* --- Пакетный прогон ------------------------------------------------------ */

/**
 * Отвечающий: по вопросу возвращает номер выбранного варианта либо null (пропуск).
 * В тестах это синтетический профиль, в проде — живой ученик через UI.
 */
export type Responder = (question: Question, state: DiagnosisState) => number | null;

/**
 * Прогоняет диагностику целиком. Сигнатура соответствует спецификации из
 * мастер-промпта: на входе целевой узел, на выходе корень, входы ИГП и шаги.
 * Внутри — тот же редьюсер, что крутит интерактивный экран, так что тесты
 * проверяют ровно тот код, который увидит жюри.
 */
export function diagnose(
  targetNodeId: string,
  responder: Responder,
  options: DiagnosisOptions = {},
): DiagnosisResult {
  let state = startDiagnosis(targetNodeId, options);
  const limit = options.questionLimit ?? QUESTION_LIMIT;

  for (let guard = 0; guard <= limit * 2 + 8; guard++) {
    if (state.result) return state.result;
    if (!state.currentQuestionId || !state.probe) break;

    const question = questionsForNode(state.probe.nodeId).find(
      (q) => q.id === state.currentQuestionId,
    );
    if (!question) break;

    state = submitAnswer(state, responder(question, state), options);
  }

  if (state.result) return state.result;
  throw new Error("Диагностика не завершилась: нарушен инвариант цикла");
}

/** Текущий вопрос сессии — удобство для UI. */
export function currentQuestion(state: DiagnosisState): Question | null {
  if (!state.currentQuestionId || !state.probe) return null;
  return questionsForNode(state.probe.nodeId).find((q) => q.id === state.currentQuestionId) ?? null;
}
