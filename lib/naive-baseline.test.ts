import { describe, expect, it } from "vitest";
import { responderFromResult, runNaiveBaseline } from "./naive-baseline";
import { diagnose, QUESTION_LIMIT, type Responder } from "./diagnose";
import { buildPrereqChain, descendantsOf, loadGraph } from "./graph";
import { questionsForNode } from "./data";

const graph = loadGraph();

function makeStudent(trueRootId: string): Responder {
  const blocked = new Set([trueRootId, ...descendantsOf(graph, trueRootId)]);
  return (q) =>
    blocked.has(q.nodeId) ? q.options.findIndex((_, i) => i !== q.correctIndex) : q.correctIndex;
}

const answerEverything: Responder = (q) => q.correctIndex;

describe("симулятор НЕ находит корень — иначе сравнение врёт", () => {
  it("никогда не покидает целевой узел", () => {
    for (const target of ["linear_equations_systems", "quadratic_equations", "area_polygons"]) {
      for (const rootId of buildPrereqChain(graph, target).slice(0, 5)) {
        const result = runNaiveBaseline(target, makeStudent(rootId));
        const visited = new Set(result.steps.map((s) => s.nodeId));
        expect(visited, `${target}/${rootId}`).toEqual(new Set([target]));
        expect(result.nodesVisited).toBe(1);
      }
    }
  });

  it("foundRoot всегда false, спуска нет ни на один класс", () => {
    for (const node of graph.nodes) {
      for (const responder of [makeStudent(node.id), answerEverything]) {
        const result = runNaiveBaseline(node.id, responder);
        expect(result.foundRoot, node.id).toBe(false);
        expect(result.gradesDescended, node.id).toBe(0);
      }
    }
  });

  it("максимум его вывода — «тема не освоена», без причины", () => {
    const result = runNaiveBaseline("linear_equations_systems", makeStudent("frac_operations"));
    expect(result.conclusion).toBe("topic_not_mastered");
    expect(Object.keys(result)).not.toContain("root");
  });

  it("не касается графа предпосылок: цепочка целевого узла ему не нужна", () => {
    const result = runNaiveBaseline("linear_equations_systems", makeStudent("frac_operations"));
    const chain = new Set(buildPrereqChain(graph, "linear_equations_systems"));
    for (const step of result.steps) expect(chain.has(step.nodeId)).toBe(false);
  });
});

describe("бюджет и честность модели", () => {
  it("работает в том же лимите, что и TAMYR", () => {
    const result = runNaiveBaseline("linear_equations_systems", makeStudent("frac_operations"));
    expect(result.questionsAsked).toBeLessThanOrEqual(QUESTION_LIMIT);
  });

  it("упирается в лимит, когда ученик не владеет темой", () => {
    const result = runNaiveBaseline("linear_equations_systems", makeStudent("frac_operations"));
    expect(result.questionsAsked).toBe(QUESTION_LIMIT);
    expect(result.outcome).toBe("limit_reached");
    expect(result.errors).toBe(QUESTION_LIMIT);
  });

  it("честно помечает смоделированные шаги, когда реальные задания кончились", () => {
    const target = "linear_equations_systems";
    const real = questionsForNode(target).length;
    const result = runNaiveBaseline(target, makeStudent("frac_operations"));

    expect(result.steps.filter((s) => !s.synthetic)).toHaveLength(real);
    expect(result.steps.filter((s) => s.synthetic).length).toBeGreaterThan(0);
  });

  it("останавливается, когда ученик действительно владеет темой", () => {
    const result = runNaiveBaseline("linear_equations_systems", answerEverything);
    expect(result.outcome).toBe("topic_mastered");
    expect(result.questionsAsked).toBe(2);
    expect(result.errors).toBe(0);
  });

  it("не падает на узле без заданий", () => {
    const result = runNaiveBaseline("ghost_node", makeStudent("frac_operations"));
    expect(result.outcome).toBe("out_of_questions");
    expect(result.questionsAsked).toBe(0);
  });
});

describe("сравнение с TAMYR на демо-профиле", () => {
  const responder = makeStudent("frac_operations");
  const tamyr = diagnose("linear_equations_systems", responder);
  const naive = runNaiveBaseline("linear_equations_systems", responder);

  it("TAMYR находит причину, наивная система — нет", () => {
    expect(tamyr.root.id).toBe("frac_operations");
    expect(naive.foundRoot).toBe(false);
  });

  it("TAMYR тратит меньше вопросов и при этом отвечает на вопрос «почему»", () => {
    expect(tamyr.questionsAsked).toBeLessThan(naive.questionsAsked);
  });

  it("TAMYR спускается на два класса, наивная система остаётся на месте", () => {
    expect(tamyr.target.grade - tamyr.root.grade).toBe(2);
    expect(naive.gradesDescended).toBe(0);
  });

  it("оба прогоняют ОДНОГО ученика — сравнение корректно", () => {
    const again = runNaiveBaseline("linear_equations_systems", makeStudent("frac_operations"));
    expect(again.steps.map((s) => s.questionId)).toEqual(naive.steps.map((s) => s.questionId));
  });
});

describe("responderFromResult — тот же ученик, а не другой", () => {
  const responder = makeStudent("frac_operations");
  const result = diagnose("linear_equations_systems", responder);
  const restored = responderFromResult(result);

  it("воспроизводит реальные ответы ученика по записанным шагам", () => {
    for (const step of result.steps) {
      const question = questionsForNode(step.nodeId).find((q) => q.id === step.questionId)!;
      expect(restored(question, null as never), step.questionId).toBe(step.answerIndex);
    }
  });

  it("на незаданных вопросах достраивает ответ по модели владения", () => {
    const asked = new Set(result.steps.map((s) => s.questionId));
    const fresh = questionsForNode("natural_numbers").find((q) => !asked.has(q.id))!;
    // natural_numbers освоен — значит верный ответ.
    expect(result.masteredNodeIds).toContain("natural_numbers");
    expect(restored(fresh, null as never)).toBe(fresh.correctIndex);
  });

  it("даёт тот же итог наивной системы, что и исходный ученик", () => {
    const fromLive = runNaiveBaseline("linear_equations_systems", responder);
    const fromResult = runNaiveBaseline("linear_equations_systems", restored);
    expect(fromResult.questionsAsked).toBe(fromLive.questionsAsked);
    expect(fromResult.conclusion).toBe(fromLive.conclusion);
  });
});
