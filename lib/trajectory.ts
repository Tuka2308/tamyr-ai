import { buildPrereqChain, descendantsOf, loadGraph, type Graph } from "./graph";
import type { Grade, Node } from "./types";

/* ============================================================================
   Траектория закрытия пробела и порядок отрисовки «разреза».
   Чистые функции поверх графа: ни состояния, ни обращений к данным сессии.
   ============================================================================ */

export type TrajectoryState =
  /** Ученик уже владеет узлом. */
  | "mastered"
  /** Найденный корень — отсюда начинается работа. */
  | "root"
  /** Ближайший шаг после корня. */
  | "next"
  /** Ещё закрыт: зависит от неосвоенного. */
  | "locked"
  /** Целевой узел, ради которого всё затевалось. */
  | "target";

export type TrajectoryStep = {
  node: Node;
  state: TrajectoryState;
  /** Позиция снизу вверх, от корня к цели. */
  position: number;
};

/**
 * Полный маршрут от корня до цели — то, что показывает экран /path.
 *
 * Берём пересечение двух множеств: всё, что зависит от корня (иначе узел
 * не заблокирован пробелом), и всё, от чего зависит цель (иначе узел
 * к задаче ученика не относится). Пересечение — ровно тот материал, который
 * придётся закрыть, чтобы разблокировать цель, без единого лишнего узла.
 *
 * Порядок — топологический: предпосылка всегда раньше зависимого узла,
 * то есть маршрут читается снизу вверх и его можно проходить подряд.
 */
export function buildFullTrajectory(
  rootId: string,
  targetId: string,
  options: { graph?: Graph; masteredNodeIds?: readonly string[] } = {},
): TrajectoryStep[] {
  const graph = options.graph ?? loadGraph();
  const root = graph.byId.get(rootId);
  const target = graph.byId.get(targetId);
  if (!root || !target) throw new Error("Траектория: узел не найден в графе");

  // Корень совпал с целью — маршрут из одного узла.
  if (rootId === targetId) {
    return [{ node: root, state: "root", position: 0 }];
  }

  const fromRoot = new Set([rootId, ...descendantsOf(graph, rootId)]);
  const toTarget = new Set([targetId, ...buildPrereqChain(graph, targetId)]);

  const ids = graph.order.filter((id) => fromRoot.has(id) && toTarget.has(id));

  // Если корень не ведёт к цели (бывает при limit_reached), маршрут вырождается
  // в хвост цепочки предпосылок цели — лучше показать его, чем пустой экран.
  const ordered =
    ids.length > 0
      ? ids
      : graph.order.filter((id) => toTarget.has(id) && !options.masteredNodeIds?.includes(id));

  const mastered = new Set(options.masteredNodeIds ?? []);

  return ordered.map((id, position) => {
    const node = graph.byId.get(id)!;
    let state: TrajectoryState;

    if (id === rootId) state = "root";
    else if (id === targetId) state = "target";
    else if (mastered.has(id)) state = "mastered";
    else if (position === 1) state = "next";
    else state = "locked";

    return { node, state, position };
  });
}

/* --- Порядок отрисовки ---------------------------------------------------- */

export type DisplayNode = {
  nodeId: string;
  grade: Grade;
  /** Позиция в алгоритмической цепочке — ею подписаны шаги в логах. */
  chainIndex: number;
  /** Позиция на экране, сверху вниз по классам. */
  displayIndex: number;
};

/**
 * Порядок узлов для «разреза».
 *
 * Алгоритмическая цепочка топологична, но НЕ монотонна по классам: для цели
 * quadratic_equations порядок классов выглядит как 555566667677778787. Если
 * рисовать скобку прямо по нему, она будет прыгать между слоями и метафора
 * «чем глубже пробел, тем ниже он лежит» сломается на глазах у жюри.
 *
 * Поэтому порядок отрисовки отделён от алгоритмического: сортируем по классу,
 * при равном классе сохраняем исходный порядок цепочки. Алгоритм этого не
 * видит — chainIndex остаётся прежним, и подписи шагов сходятся с логами.
 */
export function buildDisplayOrder(chain: readonly string[], graph?: Graph): DisplayNode[] {
  const g = graph ?? loadGraph();

  return chain
    .map((nodeId, chainIndex) => ({
      nodeId,
      chainIndex,
      grade: g.byId.get(nodeId)?.grade ?? 5,
    }))
    .sort((a, b) => a.grade - b.grade || a.chainIndex - b.chainIndex)
    .map((item, displayIndex) => ({ ...item, displayIndex }));
}

/**
 * Границы скобки бинарного поиска в экранных координатах.
 *
 * Интервал [lo, hi] непрерывен в алгоритмическом порядке, но после сортировки
 * по классам может распасться на несколько кусков. Берём охватывающий отрезок
 * min..max — для монотонных цепочек (включая демо-сценарий) он точен, для
 * остальных это честное приближение «ищем где-то здесь».
 */
export function bracketBounds(
  displayOrder: readonly DisplayNode[],
  lo: number,
  hi: number,
): { from: number; to: number } | null {
  const inside = displayOrder.filter((d) => d.chainIndex >= lo && d.chainIndex <= hi);
  if (inside.length === 0) return null;

  return {
    from: Math.min(...inside.map((d) => d.displayIndex)),
    to: Math.max(...inside.map((d) => d.displayIndex)),
  };
}
