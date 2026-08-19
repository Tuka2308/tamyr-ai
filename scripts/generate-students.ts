#!/usr/bin/env tsx
/**
 * Генератор /data/seed_students.json. Запуск: npm run generate:students
 *
 * Профили синтетические и детерминированные (фиксированный seed): при повторном
 * запуске файл не меняется. Генерация, а не ручная запись, выбрана ради
 * ссылочной целостности — rootNodeId, masteredNodeIds и questionId в истории
 * ошибок обязаны существовать в graph.json и questions.json.
 *
 * Распределение корней намеренно неравномерное: узлы дробей держат больше
 * половины класса. Это и есть демонстрационная ценность тепловой карты.
 */
import { writeFileSync } from "node:fs";
import { buildPrereqChain, descendantsOf, loadGraph } from "../lib/graph";
import { computeGdi, computeGdiInputs } from "../lib/gdi";
import questionsFile from "../data/questions.json";
import type { Grade, Locale, Question, Student, StudentError } from "../lib/types";

const graph = loadGraph();
const questions = questionsFile.questions as unknown as Question[];

const questionsByNode = new Map<string, Question[]>();
for (const q of questions) {
  questionsByNode.set(q.nodeId, [...(questionsByNode.get(q.nodeId) ?? []), q]);
}

/** Детерминированный PRNG (mulberry32) — файл воспроизводим байт в байт. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = makeRandom(20260819);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

/* --- Распределение корней: перекос на узлы дробей ------------------ */

const ROOT_DISTRIBUTION: { rootNodeId: string; count: number }[] = [
  { rootNodeId: "frac_operations", count: 7 },
  { rootNodeId: "frac_common_denom", count: 5 },
  { rootNodeId: "fractions_basic", count: 2 },
  { rootNodeId: "negative_numbers", count: 2 },
  { rootNodeId: "linear_expressions", count: 2 },
  { rootNodeId: "proportion", count: 2 },
  { rootNodeId: "order_of_operations", count: 1 },
  { rootNodeId: "decimal_operations", count: 1 },
  { rootNodeId: "powers_natural", count: 1 },
  { rootNodeId: "angle_measure", count: 1 },
  { rootNodeId: "triangles_basic", count: 1 },
];

/** Узлы, с которых стартует диагностика, по классу ученика. */
const TARGETS_BY_GRADE: Record<Grade, string[]> = {
  5: ["text_problems_arithmetic", "perimeter_area_basic"],
  6: ["percent_problems", "rational_operations", "simple_equations_6"],
  7: ["linear_equations", "word_problems_equations", "linear_function", "triangle_angles_sum"],
  8: ["linear_equations_systems", "quadratic_equations", "pythagorean_theorem", "area_polygons"],
};

const NAMES = [
  "Айгерім Сәрсенова", "Данияр Оспанов", "Аружан Қалиева", "Ерасыл Тұрсынов",
  "Мадина Жақсылық", "Алихан Бекетов", "Дана Мұратқызы", "Нұрсұлтан Әбдіров",
  "Ясмин Ковалёва", "Тимур Ахметов", "Камила Ержанова", "Артём Соколов",
  "Аяулым Досжан", "Бекзат Нұрланұлы", "Сабина Исаева", "Даниил Петров",
  "Жансая Омарова", "Рустам Каримов", "Алина Ким", "Нұрай Сағындық",
  "Мирас Төлеген", "Виктория Лебедева", "Асель Байжан", "Санжар Қуаныш",
  "Диана Шаймерден",
];

const LOCALES: Locale[] = ["kk", "kk", "kk", "ru", "ru", "en"];

/* --- Сборка профилей ------------------------------------------------ */

const students: Student[] = [];
let index = 0;

for (const { rootNodeId, count } of ROOT_DISTRIBUTION) {
  const root = graph.byId.get(rootNodeId);
  if (!root) throw new Error(`Неизвестный корневой узел «${rootNodeId}»`);

  // Всё, что стоит на этом корне, ученик не освоил.
  const blocked = new Set([rootNodeId, ...descendantsOf(graph, rootNodeId)]);

  for (let i = 0; i < count; i++) {
    // Ученик учится минимум на класс выше корня — иначе пробел не «корневой».
    const grade = Math.min(8, Math.max(root.grade + 1, 6 + Math.floor(random() * 3))) as Grade;

    const targetCandidates = TARGETS_BY_GRADE[grade].filter((id) => blocked.has(id));
    const targetNodeId = targetCandidates.length > 0 ? pick(targetCandidates) : pick(TARGETS_BY_GRADE[grade]);

    // Освоено всё, что не заблокировано корнем, в пределах класса ученика,
    // минус 0–3 случайных узла — идеальных учеников не бывает.
    const reachable = graph.nodes
      .filter((n) => n.grade <= grade && !blocked.has(n.id))
      .map((n) => n.id);
    const holes = new Set<string>();
    const holeCount = Math.floor(random() * 4);
    for (let h = 0; h < holeCount && reachable.length > 0; h++) holes.add(pick(reachable));
    const masteredNodeIds = reachable.filter((id) => !holes.has(id));

    const gdiInputs = computeGdiInputs(graph, { studentGrade: grade, rootNodeId, masteredNodeIds });
    const gdi = computeGdi(gdiInputs);

    // История ошибок: провал на целевом узле, затем на корне — так шёл спуск.
    const errors: StudentError[] = [];
    const chain = buildPrereqChain(graph, targetNodeId);
    const errorNodes = [targetNodeId, ...chain.filter((id) => blocked.has(id))].slice(0, 3);

    for (const nodeId of errorNodes) {
      const pool = questionsByNode.get(nodeId);
      if (!pool || pool.length === 0) continue;
      const question = pick(pool);

      // Выбираем именно неверный вариант — это ведь история ошибок.
      const wrongIndexes = question.options
        .map((_, idx) => idx)
        .filter((idx) => idx !== question.correctIndex);
      const chosenIndex = pick(wrongIndexes);

      errors.push({
        nodeId,
        questionId: question.id,
        chosenIndex,
        tag: question.misconceptionTags?.[chosenIndex] ?? "unknown",
      });
    }

    const day = 10 + Math.floor(random() * 8);
    students.push({
      id: `s${String(index + 1).padStart(2, "0")}`,
      name: NAMES[index]!,
      grade,
      locale: pick(LOCALES),
      rootNodeId,
      targetNodeId,
      masteredNodeIds,
      gdi: Number(gdi.toFixed(3)),
      gdiInputs: {
        depth: Number(gdiInputs.depth.toFixed(3)),
        breadth: Number(gdiInputs.breadth.toFixed(3)),
        centrality: Number(gdiInputs.centrality.toFixed(3)),
      },
      errors,
      questionsAsked: 5 + Math.floor(random() * 9),
      diagnosedAt: `2026-08-${String(day).padStart(2, "0")}`,
    });

    index++;
  }
}

writeFileSync(
  "data/seed_students.json",
  JSON.stringify(
    {
      version: "2026.08.19",
      note: "СИНТЕТИЧЕСКИЕ профили. За ними не стоит ни один реальный ученик. Сгенерированы scripts/generate-students.ts с фиксированным seed. Распределение корней намеренно неравномерное — под тепловую карту учителя.",
      students,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

/* --- Отчёт ----------------------------------------------------------- */

const byRoot = new Map<string, number>();
for (const s of students) byRoot.set(s.rootNodeId, (byRoot.get(s.rootNodeId) ?? 0) + 1);

console.log(`seed_students.json — ${students.length} профилей\n`);
console.log("  распределение корневых пробелов:");
for (const [rootNodeId, count] of [...byRoot.entries()].sort((a, b) => b[1] - a[1])) {
  const node = graph.byId.get(rootNodeId)!;
  const bar = "█".repeat(count);
  const pct = ((count / students.length) * 100).toFixed(0).padStart(3);
  console.log(`    ${bar.padEnd(7)} ${String(count).padStart(2)} (${pct}%)  ${node.grade}кл  ${node.title.ru}`);
}

const top2 = [...byRoot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
const top2Share = top2.reduce((sum, [, c]) => sum + c, 0) / students.length;
console.log(
  `\n  два самых частых узла держат ${(top2Share * 100).toFixed(0)}% класса — это и есть заголовок тепловой карты`,
);

const avgGdi = students.reduce((s, x) => s + x.gdi, 0) / students.length;
console.log(`  средний ИГП: ${avgGdi.toFixed(3)}`);
const byGrade = new Map<number, number>();
for (const s of students) byGrade.set(s.grade, (byGrade.get(s.grade) ?? 0) + 1);
console.log(`  по классам: ${[...byGrade.entries()].sort().map(([g, c]) => `${g}кл ${c}`).join(", ")}`);
console.log("");
