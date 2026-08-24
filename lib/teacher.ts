import { descendantsOf, loadGraph, type Graph } from "./graph";
import { seedStudents } from "./students";
import type { ClassStudent, Node, Student } from "./types";

/* ============================================================================
   Агрегация для панели учителя.

   Тепловая карта строится по узлам, где у класса РЕАЛЬНО есть пробелы —
   их 11 из 75. Остальные 64 колонки были бы пустыми и размывали бы ровно то,
   что должно бросаться в глаза: концентрацию. Полный список узлов остаётся
   доступен в свёрнутом блоке — это подача, а не сокрытие данных.
   ============================================================================ */

/**
 * Собирает класс: демо-профили плюс живые регистрации.
 *
 * Демо остаются, потому что на одном-двух живых учениках тепловая карта
 * нечитаема и панель перестаёт показывать то, ради чего сделана. Но каждая
 * запись несёт origin, и в интерфейсе видно, где синтетика, а где нет —
 * тот же принцип, что у симулятора наивной системы и пустого survey_results.
 */
export function combineClass(live: readonly Student[] = []): ClassStudent[] {
  const demo: ClassStudent[] = seedStudents.map((s) => ({ ...s, origin: "demo" }));
  const liveIds = new Set(live.map((s) => s.id));

  return [
    ...live.map((s): ClassStudent => ({ ...s, origin: "live" })),
    // Если живой ученик каким-то образом получил id демо-профиля,
    // приоритет у настоящих данных.
    ...demo.filter((s) => !liveIds.has(s.id)),
  ];
}

/** Состояние клетки «ученик × узел». Порядок важен: от тяжёлого к лёгкому. */
export type HeatLevel =
  /** Корневой пробел именно здесь — отсюда нужно начинать. */
  | "root"
  /** Зафиксирована ошибка на задании этого узла. */
  | "error"
  /** Узел заблокирован корневым пробелом ученика: до него не добраться. */
  | "blocked"
  /** Освоено. */
  | "mastered"
  /** Узел вне программы этого ученика (старше его класса). */
  | "out_of_scope";

export type HotNode = {
  node: Node;
  /** Скольким ученикам этот узел является корневым пробелом. */
  rootFor: number;
  /** Сколько зафиксированных ошибок пришлось на задания этого узла. */
  errorCount: number;
  /** Сколько учеников заблокировано этим узлом (корень или его потомок). */
  blockedStudents: number;
};

export type Priority = {
  nodes: HotNode[];
  /** Доля учеников, чей корневой пробел лежит в этих узлах. */
  studentShare: number;
  /** Абсолютное число таких учеников. */
  studentCount: number;
  /** Сколько зафиксированных ошибок приходится на эти узлы. */
  errorCount: number;
  totalStudents: number;
  totalErrors: number;
};

/**
 * Узлы, где у класса есть корневые пробелы, от частого к редкому.
 * Только они попадают в колонки тепловой карты.
 */
export function hotNodes(students: readonly Student[] = seedStudents, graph?: Graph): HotNode[] {
  const g = graph ?? loadGraph();

  const rootFor = new Map<string, number>();
  const errorCount = new Map<string, number>();

  for (const student of students) {
    rootFor.set(student.rootNodeId, (rootFor.get(student.rootNodeId) ?? 0) + 1);
    for (const error of student.errors) {
      errorCount.set(error.nodeId, (errorCount.get(error.nodeId) ?? 0) + 1);
    }
  }

  return [...rootFor.entries()]
    .map(([nodeId, count]) => {
      const node = g.byId.get(nodeId)!;
      const blocked = new Set([nodeId, ...descendantsOf(g, nodeId)]);
      return {
        node,
        rootFor: count,
        errorCount: errorCount.get(nodeId) ?? 0,
        blockedStudents: students.filter((s) => blocked.has(s.rootNodeId)).length,
      };
    })
    .sort((a, b) => b.rootFor - a.rootFor || a.node.grade - b.node.grade);
}

/** Состояние одной клетки тепловой карты. */
export function heatLevel(student: Student, nodeId: string, graph?: Graph): HeatLevel {
  const g = graph ?? loadGraph();
  const node = g.byId.get(nodeId);
  if (!node) return "out_of_scope";

  if (student.rootNodeId === nodeId) return "root";
  if (node.grade > student.grade) return "out_of_scope";
  if (student.errors.some((e) => e.nodeId === nodeId)) return "error";
  if (student.masteredNodeIds.includes(nodeId)) return "mastered";

  // Не освоен и не в списке освоенных — значит заблокирован корнем.
  const blocked = new Set([student.rootNodeId, ...descendantsOf(g, student.rootNodeId)]);
  return blocked.has(nodeId) ? "blocked" : "out_of_scope";
}

/**
 * Автоприоритет: какие узлы закрыть первыми.
 *
 * Основная метрика — доля УЧЕНИКОВ, чей корневой пробел лежит в этих узлах,
 * а не доля ошибок. Причина: ошибка на задании может быть невнимательностью
 * и не означает пробела, а корень — означает по построению. Число ошибок
 * показываем рядом отдельной цифрой, чтобы формулировка кейса про «ошибки»
 * не игнорировалась, а честно уточнялась.
 */
export function topPriority(
  count = 2,
  students: readonly Student[] = seedStudents,
  graph?: Graph,
): Priority {
  const hot = hotNodes(students, graph).slice(0, count);
  const ids = new Set(hot.map((h) => h.node.id));

  const studentCount = students.filter((s) => ids.has(s.rootNodeId)).length;
  const totalErrors = students.reduce((sum, s) => sum + s.errors.length, 0);
  const errorCount = students.reduce(
    (sum, s) => sum + s.errors.filter((e) => ids.has(e.nodeId)).length,
    0,
  );

  return {
    nodes: hot,
    studentShare: students.length === 0 ? 0 : studentCount / students.length,
    studentCount,
    errorCount,
    totalStudents: students.length,
    totalErrors,
  };
}

/** Средний ИГП класса и разбивка по полосам — сводка над картой. */
export function classSummary(students: readonly Student[] = seedStudents) {
  const gdiValues = students.map((s) => s.gdi);
  const averageGdi = gdiValues.reduce((a, b) => a + b, 0) / (students.length || 1);

  const byGrade = new Map<number, number>();
  for (const s of students) byGrade.set(s.grade, (byGrade.get(s.grade) ?? 0) + 1);

  return {
    total: students.length,
    averageGdi,
    deepest: [...students].sort((a, b) => b.gdi - a.gdi)[0] ?? null,
    byGrade: [...byGrade.entries()].sort((a, b) => a[0] - b[0]),
  };
}
