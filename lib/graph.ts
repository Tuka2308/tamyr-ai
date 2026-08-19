import rawGraph from "../data/graph.json";
import { GRADES, type Grade, type GraphFile, type Node } from "./types";

/* ============================================================
   Работа с графом предпосылок.
   centrality нигде не хранится — она всегда результат обхода.
   ============================================================ */

export type GraphIssue = {
  kind: "duplicate_id" | "missing_prerequisite" | "cycle" | "bad_grade_order" | "missing_title";
  nodeId: string;
  message: string;
};

export type Graph = {
  version: string;
  nodes: Node[];
  byId: Map<string, Node>;
  /** nodeId -> узлы, для которых он является предпосылкой (исходящие рёбра). */
  dependents: Map<string, string[]>;
  /** Топологический порядок: предпосылки всегда раньше зависимых узлов. */
  order: string[];
};

const source = rawGraph as unknown as GraphFile;

/* --- Валидация -------------------------------------------------- */

/** Полная проверка. Возвращает список проблем; пустой список = граф корректен. */
export function validateGraph(nodes: Node[]): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const byId = new Map<string, Node>();

  for (const node of nodes) {
    if (byId.has(node.id)) {
      issues.push({ kind: "duplicate_id", nodeId: node.id, message: `Повтор id «${node.id}»` });
      continue;
    }
    byId.set(node.id, node);
  }

  for (const node of nodes) {
    for (const locale of ["kk", "ru", "en"] as const) {
      if (!node.title[locale]?.trim()) {
        issues.push({
          kind: "missing_title",
          nodeId: node.id,
          message: `У узла «${node.id}» пустой заголовок для языка ${locale}`,
        });
      }
    }

    for (const prereqId of node.prerequisites) {
      const prereq = byId.get(prereqId);
      if (!prereq) {
        issues.push({
          kind: "missing_prerequisite",
          nodeId: node.id,
          message: `Узел «${node.id}» ссылается на несуществующую предпосылку «${prereqId}»`,
        });
        continue;
      }
      if (prereq.grade > node.grade) {
        issues.push({
          kind: "bad_grade_order",
          nodeId: node.id,
          message: `Предпосылка «${prereqId}» (${prereq.grade} кл.) идёт позже узла «${node.id}» (${node.grade} кл.)`,
        });
      }
    }
  }

  const cycle = findCycle(nodes, byId);
  if (cycle) {
    issues.push({
      kind: "cycle",
      nodeId: cycle[0] ?? "",
      message: `Цикл в графе предпосылок: ${cycle.join(" → ")}`,
    });
  }

  return issues;
}

/** Поиск цикла обходом в глубину. Возвращает путь цикла или null. */
function findCycle(nodes: Node[], byId: Map<string, Node>): string[] | null {
  const WHITE = 0,
    GREY = 1,
    BLACK = 2;
  const color = new Map<string, number>(nodes.map((n) => [n.id, WHITE]));
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    color.set(id, GREY);
    stack.push(id);

    for (const prereqId of byId.get(id)?.prerequisites ?? []) {
      if (!byId.has(prereqId)) continue; // битые ссылки ловятся отдельно
      const state = color.get(prereqId);
      if (state === GREY) {
        const start = stack.indexOf(prereqId);
        return [...stack.slice(start), prereqId];
      }
      if (state === WHITE) {
        const found = visit(prereqId);
        if (found) return found;
      }
    }

    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      const found = visit(node.id);
      if (found) return found;
    }
  }
  return null;
}

/* --- Построение --------------------------------------------------- */

/** Топологическая сортировка Кана: предпосылки раньше зависимых узлов. */
export function topologicalOrder(nodes: Node[]): string[] {
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const ids = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    const deps = node.prerequisites.filter((id) => ids.has(id));
    indegree.set(node.id, deps.length);
    for (const prereqId of deps) {
      dependents.set(prereqId, [...(dependents.get(prereqId) ?? []), node.id]);
    }
  }

  // Стабильность: при равных условиях сначала младший класс, потом id.
  const ready = nodes
    .filter((n) => (indegree.get(n.id) ?? 0) === 0)
    .sort((a, b) => a.grade - b.grade || a.id.localeCompare(b.id))
    .map((n) => n.id);

  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const dependentId of dependents.get(id) ?? []) {
      const left = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, left);
      if (left === 0) ready.push(dependentId);
    }
  }

  return order;
}

/** Все узлы, зависящие от данного (транзитивно) — обход по исходящим рёбрам. */
export function descendantsOf(graph: Graph, nodeId: string): string[] {
  const seen = new Set<string>();
  const queue = [...(graph.dependents.get(nodeId) ?? [])];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(graph.dependents.get(id) ?? []));
  }

  return [...seen];
}

/**
 * centrality = |потомки(узел)| / |узлы выше по программе|.
 * «Выше по программе» = узлы того же класса и старше, кроме самого узла.
 * Считается обходом графа, в JSON не хранится.
 */
export function computeCentrality(graph: Graph, nodeId: string): number {
  const node = graph.byId.get(nodeId);
  if (!node) return 0;

  const above = graph.nodes.filter((n) => n.grade >= node.grade && n.id !== nodeId).length;
  if (above === 0) return 0;

  return Math.min(1, descendantsOf(graph, nodeId).length / above);
}

/**
 * Цепочка транзитивных предпосылок узла — от фундамента к цели.
 * Сам целевой узел НЕ включён: он проверяется отдельно до бинарного поиска.
 * Именно по этому массиву день 3 ведёт бинарный поиск корня.
 */
export function buildPrereqChain(graph: Graph, targetId: string): string[] {
  const seen = new Set<string>();
  const queue = [...(graph.byId.get(targetId)?.prerequisites ?? [])];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id) || id === targetId) continue;
    seen.add(id);
    queue.push(...(graph.byId.get(id)?.prerequisites ?? []));
  }

  return graph.order.filter((id) => seen.has(id));
}

/** Узлы одного класса — слой «разреза». */
export function nodesByGrade(graph: Graph, grade: Grade): Node[] {
  return graph.nodes.filter((n) => n.grade === grade);
}

/** Слои разреза сверху вниз для отрисовки: 8 класс первым, 5 — внизу. */
export function strata(graph: Graph): { grade: Grade; nodes: Node[] }[] {
  return [...GRADES]
    .sort((a, b) => b - a)
    .map((grade) => ({ grade, nodes: nodesByGrade(graph, grade) }));
}

/* --- Загрузка ------------------------------------------------------ */

let cached: Graph | null = null;

/**
 * Читает /data/graph.json, проверяет и достраивает centrality.
 * Бросает исключение на некорректном графе — лучше упасть на старте,
 * чем показать жюри неверный маршрут.
 */
export function loadGraph(): Graph {
  if (cached) return cached;

  const nodes: Node[] = source.nodes.map((n) => ({ ...n, prerequisites: [...n.prerequisites] }));
  const issues = validateGraph(nodes);

  if (issues.length > 0) {
    throw new Error(
      `graph.json не прошёл валидацию (${issues.length}):\n` +
        issues.map((i) => `  · ${i.message}`).join("\n"),
    );
  }

  const dependents = new Map<string, string[]>();
  for (const node of nodes) {
    for (const prereqId of node.prerequisites) {
      dependents.set(prereqId, [...(dependents.get(prereqId) ?? []), node.id]);
    }
  }

  const graph: Graph = {
    version: source.version,
    nodes,
    byId: new Map(nodes.map((n) => [n.id, n])),
    dependents,
    order: topologicalOrder(nodes),
  };

  for (const node of nodes) {
    node.centrality = computeCentrality(graph, node.id);
  }

  cached = graph;
  return graph;
}

/** Для тестов: сбросить мемоизацию. */
export function resetGraphCache(): void {
  cached = null;
}
