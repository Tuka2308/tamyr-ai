#!/usr/bin/env tsx
/**
 * Валидатор /data/graph.json. Запуск: npm run validate:graph
 * Падает с кодом 1 при цикле, битой ссылке, нарушении порядка классов
 * или расхождении с обязательной цепочкой-позвоночником.
 */
import rawGraph from "../data/graph.json";
import { computeCentrality, loadGraph, topologicalOrder, validateGraph } from "../lib/graph";
import type { GraphFile, Node } from "../lib/types";

const MIN_NODES = 60;

/** Позвоночник демо-сценария: 5 класс → 8 класс, глубина 4 класса. */
const BACKBONE: { id: string; grade: number; prerequisites: string[] }[] = [
  { id: "natural_numbers", grade: 5, prerequisites: [] },
  { id: "fractions_basic", grade: 5, prerequisites: ["natural_numbers"] },
  { id: "frac_common_denom", grade: 6, prerequisites: ["fractions_basic"] },
  { id: "frac_operations", grade: 6, prerequisites: ["frac_common_denom"] },
  { id: "negative_numbers", grade: 6, prerequisites: ["frac_operations"] },
  { id: "linear_expressions", grade: 7, prerequisites: ["negative_numbers"] },
  { id: "linear_equations", grade: 7, prerequisites: ["linear_expressions"] },
  { id: "linear_equations_systems", grade: 8, prerequisites: ["linear_equations"] },
];

const errors: string[] = [];
const warnings: string[] = [];

const source = rawGraph as unknown as GraphFile;
const nodes: Node[] = source.nodes;

// 1. Структурная валидация: дубли, битые ссылки, циклы, порядок классов, переводы.
for (const issue of validateGraph(nodes)) {
  errors.push(`[${issue.kind}] ${issue.message}`);
}

// 2. Размер графа.
if (nodes.length < MIN_NODES) {
  errors.push(`[size] Узлов ${nodes.length}, требуется минимум ${MIN_NODES}`);
}

// 3. Обязательная цепочка-позвоночник — буквально, с этими id и связями.
const byId = new Map(nodes.map((n) => [n.id, n]));
for (const expected of BACKBONE) {
  const node = byId.get(expected.id);
  if (!node) {
    errors.push(`[backbone] Отсутствует обязательный узел «${expected.id}»`);
    continue;
  }
  if (node.grade !== expected.grade) {
    errors.push(`[backbone] «${expected.id}»: класс ${node.grade}, ожидался ${expected.grade}`);
  }
  for (const prereqId of expected.prerequisites) {
    if (!node.prerequisites.includes(prereqId)) {
      errors.push(`[backbone] «${expected.id}» должен зависеть от «${prereqId}»`);
    }
  }
}

// 4. Топологическая сортировка должна покрыть все узлы (страховка от цикла).
const order = topologicalOrder(nodes);
if (order.length !== nodes.length) {
  errors.push(
    `[topology] Топосорт вернул ${order.length} из ${nodes.length} узлов — в графе остался цикл`,
  );
}

// 5. Предупреждения: изолированные узлы (полезно знать, но не блокируют).
const referenced = new Set(nodes.flatMap((n) => n.prerequisites));
for (const node of nodes) {
  if (node.prerequisites.length === 0 && !referenced.has(node.id)) {
    warnings.push(`[isolated] Узел «${node.id}» не связан ни с чем`);
  }
}

/* --- Отчёт ---------------------------------------------------------- */

for (const warning of warnings) console.warn(`warn  ${warning}`);

if (errors.length > 0) {
  console.error(`\ngraph.json НЕ ПРОШЁЛ валидацию — ошибок: ${errors.length}\n`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  console.error("");
  process.exit(1);
}

const graph = loadGraph();
const byGrade = new Map<number, number>();
for (const node of graph.nodes) byGrade.set(node.grade, (byGrade.get(node.grade) ?? 0) + 1);

const top = [...graph.nodes]
  .sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0))
  .slice(0, 8);

console.log(`graph.json v${graph.version} — валидация пройдена`);
console.log(`  узлов: ${graph.nodes.length}, рёбер: ${graph.nodes.reduce((s, n) => s + n.prerequisites.length, 0)}`);
console.log(`  по классам: ${[...byGrade.entries()].sort().map(([g, c]) => `${g}кл ${c}`).join(", ")}`);
console.log(`  циклов нет, все ссылки разрешены, позвоночник на месте`);
console.log(`\n  centrality (посчитана обходом, топ-8 блокирующих узлов):`);
for (const node of top) {
  const pct = ((node.centrality ?? 0) * 100).toFixed(1).padStart(5);
  console.log(`    ${pct}%  ${node.id.padEnd(30)} ${node.grade}кл  ${node.title.ru}`);
}

// Контроль демо-сценария: корень должен блокировать заметную долю программы.
const demoRoot = graph.byId.get("frac_operations");
if (demoRoot) {
  console.log(
    `\n  демо-корень frac_operations: centrality ${((computeCentrality(graph, demoRoot.id)) * 100).toFixed(1)}%`,
  );
}
console.log("");
