#!/usr/bin/env tsx
/**
 * Печатает точную последовательность кликов для записи видео.
 * Запуск: npm run demo:profile
 *
 * Алгоритм детерминирован, поэтому одна и та же последовательность ответов
 * всегда даёт одну и ту же трассу. Импровизировать при записи не нужно
 * и нельзя: другой набор ответов даст другой корень.
 */
import { currentQuestion, startDiagnosis, submitAnswer } from "../lib/diagnose";
import { descendantsOf, loadGraph } from "../lib/graph";
import { gdiBand } from "../lib/gdi";
import { runNaiveBaseline, responderFromResult } from "../lib/naive-baseline";

const graph = loadGraph();
const TRUE_ROOT = "frac_operations";
const TARGET = "linear_equations_systems";

/** Ученик: владеет всем, что не стоит на действиях с дробями. */
const blocked = new Set([TRUE_ROOT, ...descendantsOf(graph, TRUE_ROOT)]);

let state = startDiagnosis(TARGET);
const script: string[] = [];
let n = 0;

const PHASE: Record<string, string> = {
  target: "проверка целевого узла",
  descent: "спуск по предпосылкам",
  language_check: "проверка формулировки",
  boundary: "уточнение кандидата",
};

while (!state.result) {
  const q = currentQuestion(state)!;
  const node = graph.byId.get(q.nodeId)!;
  const wrong = q.options.findIndex((_, i) => i !== q.correctIndex);
  const answer = blocked.has(q.nodeId) ? wrong : q.correctIndex;
  const letter = String.fromCharCode(65 + answer);
  const correct = answer === q.correctIndex;

  n += 1;
  script.push(
    [
      `### Вопрос ${n} — ${PHASE[state.phase]}`,
      ``,
      `- **Узел:** ${node.title.ru} (${node.grade} класс)`,
      `- **Задание:** ${q.text.ru}`,
      `- **Нажать:** вариант **${letter}** — «${q.options[answer]}»`,
      `- **Это ответ:** ${correct ? "верный ✓" : "неверный ✗"}`,
      ``,
    ].join("\n"),
  );

  state = submitAnswer(state, answer);
}

const r = state.result!;
const naive = runNaiveBaseline(TARGET, responderFromResult(r));

console.log(`## Демо-профиль: ученик 8 класса\n`);
console.log(`Старт — «${r.target.title.ru}» (${r.target.grade} класс).`);
console.log(`Всего вопросов: **${r.questionsAsked}**. Порядок ответов фиксирован.\n`);
console.log(script.join("\n"));
console.log(`### Что покажет /result\n`);
console.log(`- **Корень:** ${r.root.title.ru} (${r.root.grade} класс)`);
console.log(`- **Спуск:** ${r.target.grade - r.root.grade} класса вниз`);
console.log(`- **ИГП:** ${r.gdi} — ${gdiBand(r.gdi)}`);
console.log(`  (глубина ${r.igpInputs.depth.toFixed(2)}, широта ${r.igpInputs.breadth.toFixed(2)}, центральность ${r.igpInputs.centrality.toFixed(2)})`);
console.log(`- **Сила свидетельства:** ${r.confidence}`);
console.log(`- **Языковой барьер:** ${r.languageBarrier}`);
console.log(`- **Сравнение:** наивная система — ${naive.questionsAsked} вопросов, ${naive.nodesVisited} узел, 0 классов вниз, причина не найдена`);
console.log(`- **Траектория:** ${r.chain.length} узлов в цепочке, следующий шаг — ${graph.byId.get(r.nextNodeId ?? "")?.title.ru ?? "—"}`);
