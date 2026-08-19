import { describe, expect, it } from "vitest";
import { bracketBounds, buildDisplayOrder, buildFullTrajectory } from "./trajectory";
import { currentQuestion, diagnose, startDiagnosis, submitAnswer, type Responder } from "./diagnose";
import { buildPrereqChain, descendantsOf, loadGraph } from "./graph";

const graph = loadGraph();

function makeStudent(trueRootId: string): Responder {
  const blocked = new Set([trueRootId, ...descendantsOf(graph, trueRootId)]);
  return (q) =>
    blocked.has(q.nodeId) ? q.options.findIndex((_, i) => i !== q.correctIndex) : q.correctIndex;
}

describe("buildFullTrajectory", () => {
  const path = buildFullTrajectory("frac_operations", "linear_equations_systems");

  it("начинается корнем и заканчивается целью", () => {
    expect(path[0]!.node.id).toBe("frac_operations");
    expect(path[0]!.state).toBe("root");
    expect(path[path.length - 1]!.node.id).toBe("linear_equations_systems");
    expect(path[path.length - 1]!.state).toBe("target");
  });

  it("идёт снизу вверх: предпосылка всегда раньше зависимого узла", () => {
    const position = new Map(path.map((s, i) => [s.node.id, i]));
    for (const step of path) {
      for (const prereqId of step.node.prerequisites) {
        if (position.has(prereqId)) {
          expect(position.get(prereqId)!).toBeLessThan(position.get(step.node.id)!);
        }
      }
    }
  });

  it("не опускается ниже корня по классам", () => {
    const rootGrade = path[0]!.node.grade;
    for (const step of path) expect(step.node.grade).toBeGreaterThanOrEqual(rootGrade);
  });

  it("содержит только узлы, которые действительно стоят между корнем и целью", () => {
    const fromRoot = new Set([...descendantsOf(graph, "frac_operations"), "frac_operations"]);
    const toTarget = new Set([
      "linear_equations_systems",
      ...buildPrereqChain(graph, "linear_equations_systems"),
    ]);
    for (const step of path) {
      expect(fromRoot.has(step.node.id), step.node.id).toBe(true);
      expect(toTarget.has(step.node.id), step.node.id).toBe(true);
    }
  });

  it("помечает второй узел как ближайший шаг", () => {
    expect(path[1]!.state).toBe("next");
  });

  it("вырождается в один узел, когда корень совпал с целью", () => {
    const single = buildFullTrajectory("linear_equations", "linear_equations");
    expect(single).toHaveLength(1);
    expect(single[0]!.state).toBe("root");
  });

  it("собирается напрямую из результата диагностики", () => {
    const result = diagnose("linear_equations_systems", makeStudent("frac_operations"));
    const route = buildFullTrajectory(result.root.id, result.target.id, {
      masteredNodeIds: result.masteredNodeIds,
    });

    expect(route.length).toBeGreaterThan(1);
    expect(route[0]!.node.id).toBe(result.root.id);
    // Корень не может числиться освоенным.
    expect(route.filter((s) => s.state === "mastered").map((s) => s.node.id)).not.toContain(
      result.root.id,
    );
  });

  it("не падает ни на одной паре корень→цель из графа", () => {
    for (const node of graph.nodes.slice(0, 25)) {
      for (const rootId of buildPrereqChain(graph, node.id).slice(0, 3)) {
        expect(() => buildFullTrajectory(rootId, node.id), `${rootId}→${node.id}`).not.toThrow();
      }
    }
  });
});

describe("порядок отрисовки «разреза»", () => {
  it("монотонен по классам даже там, где алгоритмическая цепочка прыгает", () => {
    const chain = buildPrereqChain(graph, "quadratic_equations");
    const grades = chain.map((id) => graph.byId.get(id)!.grade);
    const chainMonotone = grades.every((g, i) => i === 0 || g >= grades[i - 1]!);
    expect(chainMonotone).toBe(false); // исходная цепочка немонотонна

    const display = buildDisplayOrder(chain, graph);
    const displayGrades = display.map((d) => d.grade);
    expect(displayGrades.every((g, i) => i === 0 || g >= displayGrades[i - 1]!)).toBe(true);
  });

  it("сохраняет chainIndex — подписи шагов сходятся с логами алгоритма", () => {
    const chain = buildPrereqChain(graph, "quadratic_equations");
    const display = buildDisplayOrder(chain, graph);

    expect(display).toHaveLength(chain.length);
    for (const d of display) expect(chain[d.chainIndex]).toBe(d.nodeId);
  });

  it("на монотонной цепочке демо-сценария порядок не меняется", () => {
    const chain = buildPrereqChain(graph, "linear_equations_systems");
    const display = buildDisplayOrder(chain, graph);
    expect(display.map((d) => d.nodeId)).toEqual([...chain]);
  });

  it("скобка охватывает все узлы интервала", () => {
    const chain = buildPrereqChain(graph, "linear_equations_systems");
    const display = buildDisplayOrder(chain, graph);

    const bounds = bracketBounds(display, 0, 2)!;
    expect(bounds.from).toBe(0);
    expect(bounds.to).toBe(2);

    const full = bracketBounds(display, 0, chain.length - 1)!;
    expect(full.from).toBe(0);
    expect(full.to).toBe(chain.length - 1);
  });

  it("возвращает null на пустом интервале — схлопнувшуюся скобку не рисуем", () => {
    const display = buildDisplayOrder(buildPrereqChain(graph, "linear_equations_systems"), graph);
    expect(bracketBounds(display, 5, 2)).toBeNull();
  });
});

describe("живая визуализация спуска — то, что видит жюри", () => {
  /** Прогоняет демо-сценарий и снимает состояние экрана на каждом шаге. */
  function runDemo() {
    let state = startDiagnosis("linear_equations_systems");
    const responder = makeStudent("frac_operations");
    const display = buildDisplayOrder(state.chain, graph);
    const frames: {
      bracket: { from: number; to: number } | null;
      testing: string | null;
      mastered: number;
    }[] = [];

    while (!state.result) {
      frames.push({
        bracket: bracketBounds(display, state.lo, state.hi),
        testing: state.probe?.nodeId ?? null,
        mastered: Object.values(state.nodeVerdicts).filter((v) => v.mastered).length,
      });
      state = submitAnswer(state, responder(currentQuestion(state)!, state));
    }

    return { state, frames, display };
  }

  it("скобка только сужается — она никогда не расширяется обратно", () => {
    const { frames } = runDemo();
    const widths = frames
      .map((f) => (f.bracket ? f.bracket.to - f.bracket.from : null))
      .filter((w): w is number => w !== null);

    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]!, `кадр ${i}`).toBeLessThanOrEqual(widths[i - 1]!);
    }
    expect(widths[widths.length - 1]!).toBeLessThan(widths[0]!);
  });

  it("на каждом кадре подсвечен ровно один проверяемый узел", () => {
    const { frames } = runDemo();
    for (const frame of frames) expect(frame.testing).not.toBeNull();
  });

  it("число освоенных узлов монотонно растёт", () => {
    const { frames } = runDemo();
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!.mastered).toBeGreaterThanOrEqual(frames[i - 1]!.mastered);
    }
  });

  it("каждый узел цепочки попадает в разрез ровно один раз", () => {
    const { state, display } = runDemo();
    expect(display).toHaveLength(state.chain.length);
    expect(new Set(display.map((d) => d.nodeId)).size).toBe(state.chain.length);
  });

  it("демо-разрез монотонен по классам: 5 класс внизу, 7 наверху", () => {
    const { display } = runDemo();
    const grades = display.map((d) => d.grade);
    expect(grades).toEqual([...grades].sort((a, b) => a - b));
    expect(grades[0]).toBe(5);
    expect(grades[grades.length - 1]).toBe(7);
  });

  it("после завершения корень известен и лежит в цепочке", () => {
    const { state } = runDemo();
    expect(state.result!.root.id).toBe("frac_operations");
    expect(state.chain).toContain(state.result!.root.id);
  });
});
