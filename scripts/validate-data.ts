#!/usr/bin/env tsx
/**
 * Валидатор данных дня 2. Запуск: npm run validate:data
 * Проверяет questions.json, curriculum_chunks.json и seed_students.json
 * на согласованность с graph.json и внутреннюю целостность.
 * Падает с кодом 1 — подключён к npm run build.
 */
import { loadGraph } from "../lib/graph";
import { computeGdi, computeGdiInputs } from "../lib/gdi";
import questionsFile from "../data/questions.json";
import chunksFile from "../data/curriculum_chunks.json";
import studentsFile from "../data/seed_students.json";
import { LOCALES, type CurriculumChunk, type Question, type Student } from "../lib/types";

const graph = loadGraph();
const questions = questionsFile.questions as unknown as Question[];
const chunks = chunksFile.chunks as unknown as CurriculumChunk[];
const students = studentsFile.students as unknown as Student[];

const errors: string[] = [];
const warnings: string[] = [];
const fail = (m: string) => errors.push(m);

const BACKBONE = [
  "natural_numbers", "fractions_basic", "frac_common_denom", "frac_operations",
  "negative_numbers", "linear_expressions", "linear_equations", "linear_equations_systems",
];

/** Узлы полного покрытия: позвоночник + 15 самых блокирующих. */
const TOP_CENTRALITY = [...graph.nodes]
  .filter((n) => !BACKBONE.includes(n.id))
  .sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0))
  .slice(0, 15)
  .map((n) => n.id);
const FULL_COVERAGE = new Set([...BACKBONE, ...TOP_CENTRALITY]);

const RAG_DEMO_NODES = ["frac_operations", "linear_equations", "linear_equations_systems"];
const MIN_CHUNKS_PER_DEMO_NODE = 5;

/* --- questions.json ------------------------------------------------- */

const questionById = new Map<string, Question>();
const questionsByNode = new Map<string, Question[]>();

for (const q of questions) {
  if (questionById.has(q.id)) fail(`[questions] Повтор id «${q.id}»`);
  questionById.set(q.id, q);
  questionsByNode.set(q.nodeId, [...(questionsByNode.get(q.nodeId) ?? []), q]);

  if (!graph.byId.has(q.nodeId)) {
    fail(`[questions] «${q.id}» ссылается на узел «${q.nodeId}», которого нет в графе`);
  }

  for (const locale of LOCALES) {
    if (!q.text[locale]?.trim()) fail(`[questions] «${q.id}»: пустой текст для языка ${locale}`);
  }

  if (q.options.length < 2) fail(`[questions] «${q.id}»: меньше двух вариантов ответа`);
  if (new Set(q.options).size !== q.options.length) {
    fail(`[questions] «${q.id}»: среди вариантов ответа есть дубли`);
  }
  if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
    fail(`[questions] «${q.id}»: correctIndex ${q.correctIndex} вне диапазона вариантов`);
  }

  if (q.misconception.length !== q.options.length) {
    fail(`[questions] «${q.id}»: ${q.misconception.length} разборов на ${q.options.length} вариантов`);
  }
  if (q.misconception[q.correctIndex] !== "") {
    fail(`[questions] «${q.id}»: у верного варианта должен быть пустой разбор`);
  }

  const annotated = q.misconception.filter((m, i) => i !== q.correctIndex && m.trim().length > 0).length;
  if (annotated === 0) fail(`[questions] «${q.id}»: не размечен ни один дистрактор`);
  if (FULL_COVERAGE.has(q.nodeId) && annotated !== q.options.length - 1) {
    fail(`[questions] «${q.id}»: узел полного покрытия требует разбора КАЖДОГО дистрактора`);
  }

  if (q.misconceptionTags) {
    if (q.misconceptionTags.length !== q.options.length) {
      fail(`[questions] «${q.id}»: длина misconceptionTags не совпадает с options`);
    }
    if (q.misconceptionTags[q.correctIndex] !== "none") {
      fail(`[questions] «${q.id}»: тег верного варианта должен быть "none"`);
    }
    for (const [i, tag] of q.misconceptionTags.entries()) {
      if (i !== q.correctIndex && tag === "none") {
        fail(`[questions] «${q.id}»: дистрактор ${i} помечен тегом "none"`);
      }
    }
  } else if (FULL_COVERAGE.has(q.nodeId)) {
    fail(`[questions] «${q.id}»: узел полного покрытия требует misconceptionTags`);
  }

  if ((q.phrasing && !q.pairId) || (q.pairId && !q.phrasing)) {
    fail(`[questions] «${q.id}»: phrasing и pairId должны задаваться только вместе`);
  }
}

// Покрытие узлов
for (const node of graph.nodes) {
  const pool = questionsByNode.get(node.id) ?? [];
  if (pool.length === 0) fail(`[coverage] У узла «${node.id}» нет ни одного задания`);
  else if (FULL_COVERAGE.has(node.id) && pool.length < 3) {
    fail(`[coverage] Узел полного покрытия «${node.id}»: заданий ${pool.length}, нужно ≥ 3`);
  }
}

// Пары на языковой барьер
const pairs = new Map<string, Question[]>();
for (const q of questions) {
  if (q.pairId) pairs.set(q.pairId, [...(pairs.get(q.pairId) ?? []), q]);
}
for (const [pairId, members] of pairs) {
  if (members.length !== 2) {
    fail(`[pairs] «${pairId}»: ${members.length} заданий, должно быть ровно 2`);
    continue;
  }
  const [a, b] = members as [Question, Question];
  if (a.nodeId !== b.nodeId) fail(`[pairs] «${pairId}»: задания принадлежат разным узлам`);
  const phrasings = new Set(members.map((m) => m.phrasing));
  if (!phrasings.has("long") || !phrasings.has("short")) {
    fail(`[pairs] «${pairId}»: нужна одна длинная и одна краткая формулировка`);
  }
  // Классификатор сравнивает верность ответов, а не тексты: разные id обязательны.
  if (a.id === b.id) fail(`[pairs] «${pairId}»: у пары совпадают id`);

  const long = members.find((m) => m.phrasing === "long")!;
  const short = members.find((m) => m.phrasing === "short")!;
  if (long.text.ru.length <= short.text.ru.length) {
    fail(`[pairs] «${pairId}»: «длинная» формулировка не длиннее краткой — пара бесполезна`);
  }
  // Пара обязана отличаться ТОЛЬКО длиной условия. Если различается ещё и форма
  // ответа, разница в результатах может объясняться ею, а не языковым барьером,
  // и классификатор дня 3 получит ложный сигнал.
  if (long.options[long.correctIndex] !== short.options[short.correctIndex]) {
    fail(`[pairs] «${pairId}»: у длинной и краткой формулировок разный верный ответ — в паре меняется не только длина условия`);
  }
}
for (const nodeId of BACKBONE) {
  const hasPair = questions.some((q) => q.nodeId === nodeId && q.pairId);
  if (!hasPair) fail(`[pairs] Узел позвоночника «${nodeId}» без парного задания на языковой барьер`);
}

/* --- curriculum_chunks.json ----------------------------------------- */

const chunkIds = new Set<string>();
const chunksByNode = new Map<string, CurriculumChunk[]>();

for (const c of chunks) {
  if (chunkIds.has(c.id)) fail(`[chunks] Повтор id «${c.id}»`);
  chunkIds.add(c.id);
  chunksByNode.set(c.nodeId, [...(chunksByNode.get(c.nodeId) ?? []), c]);

  if (!graph.byId.has(c.nodeId)) fail(`[chunks] «${c.id}»: узла «${c.nodeId}» нет в графе`);
  if (!(LOCALES as readonly string[]).includes(c.lang)) fail(`[chunks] «${c.id}»: неизвестный язык «${c.lang}»`);
  if (!c.text?.trim()) fail(`[chunks] «${c.id}»: пустой текст`);
  if (!c.source?.trim()) fail(`[chunks] «${c.id}»: пустое поле source — маркер источника показать будет нечем`);
  if (c.text.length < 120) warnings.push(`[chunks] «${c.id}»: очень короткий чанк (${c.text.length} символов)`);
}

for (const nodeId of RAG_DEMO_NODES) {
  const pool = (chunksByNode.get(nodeId) ?? []).filter((c) => c.lang === "ru");
  if (pool.length < MIN_CHUNKS_PER_DEMO_NODE) {
    fail(`[chunks] Демо-узел «${nodeId}»: ru-чанков ${pool.length}, нужно ≥ ${MIN_CHUNKS_PER_DEMO_NODE}`);
  }
}

/* --- seed_students.json --------------------------------------------- */

const studentIds = new Set<string>();
const rootCounts = new Map<string, number>();

for (const s of students) {
  if (studentIds.has(s.id)) fail(`[students] Повтор id «${s.id}»`);
  studentIds.add(s.id);

  const root = graph.byId.get(s.rootNodeId);
  if (!root) {
    fail(`[students] «${s.id}»: корневого узла «${s.rootNodeId}» нет в графе`);
    continue;
  }
  rootCounts.set(s.rootNodeId, (rootCounts.get(s.rootNodeId) ?? 0) + 1);

  if (!graph.byId.has(s.targetNodeId)) {
    fail(`[students] «${s.id}»: целевого узла «${s.targetNodeId}» нет в графе`);
  }
  if (root.grade >= s.grade) {
    fail(`[students] «${s.id}»: корень (${root.grade} кл.) не ниже класса ученика (${s.grade}) — это не корневой пробел`);
  }

  const mastered = new Set(s.masteredNodeIds);
  if (mastered.size !== s.masteredNodeIds.length) fail(`[students] «${s.id}»: дубли в masteredNodeIds`);
  if (mastered.has(s.rootNodeId)) {
    fail(`[students] «${s.id}»: корневой узел числится среди освоенных`);
  }
  for (const id of s.masteredNodeIds) {
    if (!graph.byId.has(id)) fail(`[students] «${s.id}»: освоенного узла «${id}» нет в графе`);
  }

  for (const e of s.errors) {
    const q = questionById.get(e.questionId);
    if (!q) {
      fail(`[students] «${s.id}»: задания «${e.questionId}» не существует`);
      continue;
    }
    if (q.nodeId !== e.nodeId) {
      fail(`[students] «${s.id}»: задание «${e.questionId}» принадлежит узлу «${q.nodeId}», а не «${e.nodeId}»`);
    }
    if (e.chosenIndex === q.correctIndex) {
      fail(`[students] «${s.id}»: в истории ошибок записан верный ответ на «${e.questionId}»`);
    }
    if (e.chosenIndex < 0 || e.chosenIndex >= q.options.length) {
      fail(`[students] «${s.id}»: chosenIndex вне диапазона в «${e.questionId}»`);
    }
  }

  if (s.gdi < 0 || s.gdi > 1) fail(`[students] «${s.id}»: ИГП ${s.gdi} вне [0, 1]`);

  // ИГП обязан сходиться с формулой из lib/gdi.ts, иначе тепловая карта соврёт.
  const recomputed = computeGdi(
    computeGdiInputs(graph, {
      studentGrade: s.grade,
      rootNodeId: s.rootNodeId,
      masteredNodeIds: s.masteredNodeIds,
    }),
  );
  if (Math.abs(recomputed - s.gdi) > 0.002) {
    fail(`[students] «${s.id}»: ИГП ${s.gdi} расходится с пересчётом по формуле (${recomputed.toFixed(3)})`);
  }
}

if (students.length !== 25) fail(`[students] Профилей ${students.length}, требуется 25`);

// Распределение обязано быть неравномерным — иначе тепловая карта бессмысленна.
const sortedRoots = [...rootCounts.entries()].sort((a, b) => b[1] - a[1]);
const top2Share = sortedRoots.slice(0, 2).reduce((sum, [, c]) => sum + c, 0) / students.length;
if (top2Share < 0.35) {
  fail(`[students] Два самых частых корня держат лишь ${(top2Share * 100).toFixed(0)}% класса — распределение слишком ровное`);
}
for (const id of ["frac_operations", "frac_common_denom"]) {
  if (!rootCounts.has(id)) fail(`[students] В распределении нет перекоса на «${id}»`);
}

/* --- Отчёт ----------------------------------------------------------- */

for (const w of warnings) console.warn(`warn  ${w}`);

if (errors.length > 0) {
  console.error(`\nДанные НЕ ПРОШЛИ валидацию — ошибок: ${errors.length}\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("");
  process.exit(1);
}

const fullyCovered = [...FULL_COVERAGE].filter((id) => (questionsByNode.get(id) ?? []).length >= 3).length;
const withAllDistractors = questions.filter(
  (q) => q.misconception.filter((m, i) => i !== q.correctIndex && m.trim()).length === q.options.length - 1,
).length;

console.log("данные дня 2 — валидация пройдена\n");
console.log(`  questions.json:          ${questions.length} заданий на ${questionsByNode.size} узлах`);
console.log(`    полное покрытие:       ${fullyCovered} узлов по ≥3 задания (позвоночник + топ-15 centrality)`);
console.log(`    разбор всех дистракторов: ${withAllDistractors} из ${questions.length} заданий`);
console.log(`    пар на языковой барьер: ${pairs.size} (все ${BACKBONE.length} узлов позвоночника)`);
console.log(`  curriculum_chunks.json:  ${chunks.length} чанков на ${chunksByNode.size} узлах`);
console.log(`  seed_students.json:      ${students.length} профилей, ${rootCounts.size} различных корней`);
console.log(`    топ-2 корня держат:    ${(top2Share * 100).toFixed(0)}% класса`);
console.log("");
