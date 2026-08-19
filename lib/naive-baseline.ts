import { questionsForNode } from "./data";
import { QUESTION_LIMIT, type Responder } from "./diagnose";
import type { DiagnosisResult, Question } from "./types";

/* ============================================================================
   СИМУЛЯТОР НАИВНОЙ АДАПТИВНОЙ СИСТЕМЫ.

   ЭТО НЕ РЕАЛЬНЫЙ СТОРОННИЙ ПРОДУКТ И НЕ ЕГО ЗАМЕР. Мы не тестировали
   конкурентов и не заявляем, что кто-то работает именно так. Это модель
   ОДНОГО правила, которое отличает нас от распространённого подхода:

       при ошибке — дать следующее, более лёгкое задание в той же теме.

   У симулятора намеренно нет доступа к графу предпосылок. Он видит только
   целевой узел и задания на нём — ровно та информация, которой располагает
   система без модели связей между темами. Отсюда и результат: он не может
   найти причину, потому что причина лежит на два класса ниже, а спускаться
   ему нечем. Это не недостаток реализации, это следствие правила.

   Бюджет вопросов тот же, что у TAMYR (15), иначе сравнение было бы нечестным.
   ============================================================================ */

export type NaiveStep = {
  index: number;
  nodeId: string;
  questionId: string;
  answerIndex: number | null;
  correct: boolean;
  /**
   * Номер «облегчения»: 0 — исходное задание, дальше система выдаёт всё более
   * простые варианты той же темы.
   */
  easingLevel: number;
  /**
   * true — задание смоделировано, а не взято из нашего набора: реальные
   * задания узла кончились, и дальше система продолжала бы генерировать
   * упрощённые варианты. Помечаем явно, чтобы не выдавать модель за данные.
   */
  synthetic: boolean;
};

export type NaiveResult = {
  targetNodeId: string;
  steps: NaiveStep[];
  questionsAsked: number;
  /**
   * Найдена ли ПРИЧИНА ошибки. Всегда false по построению: система не выходит
   * за пределы целевого узла. Поле оставлено явным, чтобы это читалось в коде,
   * а не подразумевалось.
   */
  foundRoot: false;
  /** Максимальная глубина спуска. Всегда 0 — вниз она не ходит. */
  gradesDescended: 0;
  /** Сколько РАЗНЫХ узлов она посетила. Всегда 1. */
  nodesVisited: 1;
  errors: number;
  outcome: "topic_mastered" | "limit_reached" | "out_of_questions";
  /** Максимум того, что система может заключить. */
  conclusion: "topic_mastered" | "topic_not_mastered";
};

/** Критерий «освоено» тот же, что у нас: два верных ответа подряд. */
const MASTERY_STREAK = 2;

/**
 * Прогоняет того же ученика через наивное правило.
 *
 * Задания берутся в порядке набора: метрики сложности у нас нет, и
 * придумывать её ради красивого сравнения мы не станем. Когда реальные
 * задания кончаются, шаги помечаются synthetic — система продолжала бы
 * упрощать, но данных для этого у нас нет.
 */
export function runNaiveBaseline(
  targetNodeId: string,
  responder: Responder,
  options: { questionLimit?: number } = {},
): NaiveResult {
  const limit = options.questionLimit ?? QUESTION_LIMIT;
  const pool = questionsForNode(targetNodeId);

  const steps: NaiveStep[] = [];
  let streak = 0;
  let errors = 0;
  let outcome: NaiveResult["outcome"] = "limit_reached";

  if (pool.length === 0) {
    return {
      targetNodeId,
      steps,
      questionsAsked: 0,
      foundRoot: false,
      gradesDescended: 0,
      nodesVisited: 1,
      errors: 0,
      outcome: "out_of_questions",
      conclusion: "topic_not_mastered",
    };
  }

  for (let asked = 0; asked < limit; asked++) {
    const question: Question = pool[asked % pool.length]!;
    const synthetic = asked >= pool.length;

    // Симулятор дёргает того же отвечающего, что и TAMYR: сравниваем поведение
    // алгоритмов на одном ученике, а не два разных прогона.
    const answerIndex = responder(question, null as never);
    const correct = answerIndex !== null && answerIndex === question.correctIndex;

    steps.push({
      index: asked,
      nodeId: targetNodeId,
      questionId: question.id,
      answerIndex,
      correct,
      easingLevel: asked,
      synthetic,
    });

    if (correct) {
      streak += 1;
      if (streak >= MASTERY_STREAK) {
        outcome = "topic_mastered";
        break;
      }
    } else {
      streak = 0;
      errors += 1;
    }
  }

  return {
    targetNodeId,
    steps,
    questionsAsked: steps.length,
    foundRoot: false,
    gradesDescended: 0,
    nodesVisited: 1,
    errors,
    outcome,
    conclusion: outcome === "topic_mastered" ? "topic_mastered" : "topic_not_mastered",
  };
}

/**
 * Восстанавливает того же ученика из уже пройденной диагностики.
 *
 * Сначала берутся ЕГО настоящие ответы — те, что записаны в шагах. Если
 * наивная система задаёт задание, которое TAMYR не задавал, ответ достраивается
 * по модели владения, которую построила диагностика: узел освоен — отвечает
 * верно, не освоен — ошибается.
 *
 * Достройка неизбежна: два алгоритма задают разные вопросы, и без неё сравнить
 * их на одном ученике было бы нельзя. Но реальные ответы всегда в приоритете,
 * и это ровно та же модель ученика, на которой замерялся сам алгоритм.
 */
export function responderFromResult(result: DiagnosisResult): Responder {
  const answered = new Map(result.steps.map((s) => [s.questionId, s.answerIndex]));
  const mastered = new Set(result.masteredNodeIds);

  return (question) => {
    const recorded = answered.get(question.id);
    if (recorded !== undefined) return recorded;

    return mastered.has(question.nodeId)
      ? question.correctIndex
      : question.options.findIndex((_, i) => i !== question.correctIndex);
  };
}
