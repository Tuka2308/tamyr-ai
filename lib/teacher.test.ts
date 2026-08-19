import { describe, expect, it } from "vitest";
import { classSummary, heatLevel, hotNodes, topPriority } from "./teacher";
import { seedStudents } from "./students";
import { loadGraph } from "./graph";

const graph = loadGraph();

describe("hotNodes", () => {
  const hot = hotNodes();

  it("оставляет только узлы, где у класса есть корневые пробелы", () => {
    expect(hot.length).toBeLessThan(graph.nodes.length);
    expect(hot.every((h) => h.rootFor > 0)).toBe(true);
  });

  it("совпадает с распределением seed-данных: 11 узлов", () => {
    expect(hot).toHaveLength(11);
  });

  it("отсортированы от частого к редкому", () => {
    for (let i = 1; i < hot.length; i++) {
      expect(hot[i]!.rootFor).toBeLessThanOrEqual(hot[i - 1]!.rootFor);
    }
  });

  it("на первом месте — действия с дробями", () => {
    expect(hot[0]!.node.id).toBe("frac_operations");
    expect(hot[0]!.rootFor).toBe(7);
  });

  it("сумма rootFor равна числу учеников — никто не потерян", () => {
    expect(hot.reduce((s, h) => s + h.rootFor, 0)).toBe(seedStudents.length);
  });

  it("считает, скольких учеников узел блокирует", () => {
    const fracOps = hot.find((h) => h.node.id === "frac_operations")!;
    // Блокирует и тех, чей корень ниже по той же ветви.
    expect(fracOps.blockedStudents).toBeGreaterThanOrEqual(fracOps.rootFor);
  });
});

describe("topPriority", () => {
  const priority = topPriority(2);

  it("два узла держат 48% класса — цифра из seed-данных дня 2", () => {
    expect(priority.studentCount).toBe(12);
    expect(priority.totalStudents).toBe(25);
    expect(Math.round(priority.studentShare * 100)).toBe(48);
  });

  it("это именно узлы дробей", () => {
    expect(priority.nodes.map((n) => n.node.id)).toEqual([
      "frac_operations",
      "frac_common_denom",
    ]);
  });

  it("отдаёт и счётчик ошибок — формулировку кейса не игнорируем", () => {
    expect(priority.totalErrors).toBeGreaterThan(0);
    expect(priority.errorCount).toBeGreaterThanOrEqual(0);
    expect(priority.errorCount).toBeLessThanOrEqual(priority.totalErrors);
  });

  it("три узла покрывают больше, чем два", () => {
    expect(topPriority(3).studentCount).toBeGreaterThanOrEqual(priority.studentCount);
  });

  it("кластер дробей целиком — 56% класса", () => {
    const three = topPriority(3);
    expect(three.nodes.map((n) => n.node.id)).toContain("fractions_basic");
    expect(Math.round(three.studentShare * 100)).toBe(56);
  });

  it("не падает на пустом классе", () => {
    const empty = topPriority(2, []);
    expect(empty.studentShare).toBe(0);
    expect(empty.nodes).toHaveLength(0);
  });
});

describe("heatLevel", () => {
  it("помечает корневой узел ученика как root", () => {
    const student = seedStudents.find((s) => s.rootNodeId === "frac_operations")!;
    expect(heatLevel(student, "frac_operations")).toBe("root");
  });

  it("помечает освоенные узлы как mastered", () => {
    const student = seedStudents[0]!;
    const mastered = student.masteredNodeIds[0]!;
    expect(heatLevel(student, mastered)).toBe("mastered");
  });

  it("узлы старше класса ученика вне его программы", () => {
    const student = seedStudents.find((s) => s.grade === 6)!;
    expect(heatLevel(student, "quadratic_equations")).toBe("out_of_scope");
  });

  it("возвращает валидный уровень для любой пары ученик × узел", () => {
    const allowed = ["root", "error", "blocked", "mastered", "out_of_scope"];
    for (const student of seedStudents) {
      for (const node of graph.nodes) {
        expect(allowed, `${student.id}/${node.id}`).toContain(heatLevel(student, node.id));
      }
    }
  });

  it("у каждого ученика ровно один узел уровня root", () => {
    for (const student of seedStudents) {
      const roots = graph.nodes.filter((n) => heatLevel(student, n.id) === "root");
      expect(roots, student.id).toHaveLength(1);
    }
  });
});

describe("classSummary", () => {
  const summary = classSummary();

  it("покрывает всех 25 учеников", () => {
    expect(summary.total).toBe(25);
    expect(summary.byGrade.reduce((s, [, c]) => s + c, 0)).toBe(25);
  });

  it("средний ИГП лежит в [0, 1]", () => {
    expect(summary.averageGdi).toBeGreaterThan(0);
    expect(summary.averageGdi).toBeLessThanOrEqual(1);
  });

  it("находит ученика с самым глубоким пробелом", () => {
    expect(summary.deepest).not.toBeNull();
    for (const s of seedStudents) {
      expect(s.gdi).toBeLessThanOrEqual(summary.deepest!.gdi);
    }
  });
});
