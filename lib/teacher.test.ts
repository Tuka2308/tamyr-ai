import { describe, expect, it } from "vitest";
import { classSummary, combineClass, heatLevel, hotNodes, topPriority } from "./teacher";
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

describe("combineClass — демо и живые не смешиваются молча", () => {
  const live = [
    { ...seedStudents[0]!, id: "live-1", name: "Настоящий ученик", rootNodeId: "linear_equations" },
  ];

  it("помечает происхождение каждой записи", () => {
    const cls = combineClass(live);
    expect(cls.every((s) => s.origin === "demo" || s.origin === "live")).toBe(true);
    expect(cls.filter((s) => s.origin === "live")).toHaveLength(1);
    expect(cls.filter((s) => s.origin === "demo")).toHaveLength(seedStudents.length);
  });

  it("без живых учеников отдаёт только демо-класс", () => {
    const cls = combineClass([]);
    expect(cls).toHaveLength(seedStudents.length);
    expect(cls.every((s) => s.origin === "demo")).toBe(true);
  });

  it("ставит живых первыми — их учитель ищет в первую очередь", () => {
    const cls = combineClass(live);
    expect(cls[0]!.origin).toBe("live");
  });

  it("при совпадении id приоритет у настоящих данных", () => {
    const collide = [{ ...seedStudents[0]!, name: "Перекрыл демо" }];
    const cls = combineClass(collide);
    const matching = cls.filter((s) => s.id === seedStudents[0]!.id);
    expect(matching).toHaveLength(1);
    expect(matching[0]!.origin).toBe("live");
    expect(matching[0]!.name).toBe("Перекрыл демо");
  });

  it("не мутирует исходные seed-профили", () => {
    combineClass(live);
    expect((seedStudents[0] as { origin?: string }).origin).toBeUndefined();
  });
});

describe("агрегация считается по объединённому классу", () => {
  it("живой ученик влияет на тепловую карту", () => {
    const live = [{ ...seedStudents[0]!, id: "live-x", name: "Ж", rootNodeId: "square_root" }];
    const withLive = hotNodes(combineClass(live));
    const withoutLive = hotNodes(combineClass([]));

    expect(withLive.find((h) => h.node.id === "square_root")).toBeDefined();
    expect(withoutLive.find((h) => h.node.id === "square_root")).toBeUndefined();
  });

  it("сводка класса растёт вместе с числом живых учеников", () => {
    const live = [{ ...seedStudents[0]!, id: "live-y", name: "Ж" }];
    expect(classSummary(combineClass(live)).total).toBe(seedStudents.length + 1);
  });

  it("демо-класс сохраняет показательные 48% — панель не пустеет", () => {
    const priority = topPriority(2, combineClass([]));
    expect(Math.round(priority.studentShare * 100)).toBe(48);
  });

  it("heatLevel работает для живого ученика так же, как для демо", () => {
    const live = combineClass([
      { ...seedStudents[0]!, id: "live-z", name: "Ж", rootNodeId: "frac_operations" },
    ])[0]!;
    expect(heatLevel(live, "frac_operations")).toBe("root");
  });
});
