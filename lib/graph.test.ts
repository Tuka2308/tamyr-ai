import { describe, expect, it } from "vitest";
import {
  buildPrereqChain,
  computeCentrality,
  descendantsOf,
  loadGraph,
  topologicalOrder,
  validateGraph,
} from "./graph";
import type { Node } from "./types";

const graph = loadGraph();

function node(id: string, grade: 5 | 6 | 7 | 8, prerequisites: string[]): Node {
  return {
    id,
    grade,
    subject: "math",
    prerequisites,
    title: { kk: id, ru: id, en: id },
  };
}

describe("graph.json", () => {
  it("содержит не меньше 60 узлов", () => {
    expect(graph.nodes.length).toBeGreaterThanOrEqual(60);
  });

  it("проходит валидацию без единой проблемы", () => {
    expect(validateGraph(graph.nodes)).toEqual([]);
  });

  it("топологически сортируется целиком — значит циклов нет", () => {
    expect(topologicalOrder(graph.nodes)).toHaveLength(graph.nodes.length);
  });

  it("содержит цепочку-позвоночник 5→8 класс без разрывов", () => {
    const backbone = [
      "natural_numbers",
      "fractions_basic",
      "frac_common_denom",
      "frac_operations",
      "negative_numbers",
      "linear_expressions",
      "linear_equations",
      "linear_equations_systems",
    ];

    for (let i = 1; i < backbone.length; i++) {
      const current = graph.byId.get(backbone[i]!);
      expect(current, backbone[i]).toBeDefined();
      expect(current!.prerequisites).toContain(backbone[i - 1]);
    }
  });

  it("переводит каждый узел на kk/ru/en", () => {
    for (const n of graph.nodes) {
      expect(n.title.kk.length, n.id).toBeGreaterThan(0);
      expect(n.title.ru.length, n.id).toBeGreaterThan(0);
      expect(n.title.en.length, n.id).toBeGreaterThan(0);
    }
  });
});

describe("валидатор", () => {
  it("ловит цикл и показывает его путь", () => {
    const issues = validateGraph([node("a", 5, ["c"]), node("b", 5, ["a"]), node("c", 5, ["b"])]);
    const cycle = issues.find((i) => i.kind === "cycle");
    expect(cycle).toBeDefined();
    expect(cycle!.message).toContain("→");
  });

  it("ловит ссылку на несуществующий узел", () => {
    const issues = validateGraph([node("a", 5, ["ghost"])]);
    expect(issues.map((i) => i.kind)).toContain("missing_prerequisite");
  });

  it("ловит предпосылку из старшего класса", () => {
    const issues = validateGraph([node("a", 5, ["b"]), node("b", 8, [])]);
    expect(issues.map((i) => i.kind)).toContain("bad_grade_order");
  });

  it("ловит дубль id", () => {
    const issues = validateGraph([node("a", 5, []), node("a", 6, [])]);
    expect(issues.map((i) => i.kind)).toContain("duplicate_id");
  });
});

describe("centrality", () => {
  it("не хранится в JSON, а достраивается загрузчиком", async () => {
    const raw = (await import("../data/graph.json")).default as { nodes: { centrality?: number }[] };
    expect(raw.nodes.every((n) => n.centrality === undefined)).toBe(true);
    expect(graph.nodes.every((n) => typeof n.centrality === "number")).toBe(true);
  });

  it("лежит в [0, 1]", () => {
    for (const n of graph.nodes) {
      expect(n.centrality!, n.id).toBeGreaterThanOrEqual(0);
      expect(n.centrality!, n.id).toBeLessThanOrEqual(1);
    }
  });

  it("у корня демо-сценария выше, чем у бокового узла того же класса", () => {
    const demoRoot = graph.byId.get("frac_operations")!;
    const sideBranch = graph.byId.get("scale_maps")!;
    expect(demoRoot.centrality!).toBeGreaterThan(sideBranch.centrality!);
  });

  it("у листа графа равна нулю", () => {
    const leaf = graph.nodes.find((n) => descendantsOf(graph, n.id).length === 0)!;
    expect(computeCentrality(graph, leaf.id)).toBe(0);
  });
});

describe("buildPrereqChain — вход бинарного поиска дня 3", () => {
  const chain = buildPrereqChain(graph, "linear_equations_systems");

  it("не включает сам целевой узел", () => {
    expect(chain).not.toContain("linear_equations_systems");
  });

  it("идёт от фундамента к цели: предпосылка всегда раньше зависимого узла", () => {
    const position = new Map(chain.map((id, i) => [id, i]));
    for (const id of chain) {
      for (const prereqId of graph.byId.get(id)!.prerequisites) {
        if (position.has(prereqId)) {
          expect(position.get(prereqId)!, `${prereqId} должен идти раньше ${id}`).toBeLessThan(
            position.get(id)!,
          );
        }
      }
    }
  });

  it("содержит весь позвоночник демо-сценария", () => {
    expect(chain).toEqual(
      expect.arrayContaining([
        "natural_numbers",
        "fractions_basic",
        "frac_common_denom",
        "frac_operations",
        "negative_numbers",
        "linear_expressions",
        "linear_equations",
      ]),
    );
  });

  it("начинается с узла без предпосылок — спуск упирается в фундамент", () => {
    expect(graph.byId.get(chain[0]!)!.prerequisites).toHaveLength(0);
  });
});
