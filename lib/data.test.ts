import { describe, expect, it } from "vitest";
import {
  chunksForNode,
  curriculumChunks,
  hasLanguagePair,
  pairedQuestion,
  questionById,
  questionsForNode,
  questions,
} from "./data";
import { rootGapCounts, seedStudents } from "./students";
import { loadGraph } from "./graph";
import { computeGdi, computeGdiInputs, gdiBand } from "./gdi";

const graph = loadGraph();
const BACKBONE = [
  "natural_numbers", "fractions_basic", "frac_common_denom", "frac_operations",
  "negative_numbers", "linear_expressions", "linear_equations", "linear_equations_systems",
];

describe("questions.json", () => {
  it("покрывает каждый узел графа хотя бы одним заданием", () => {
    const uncovered = graph.nodes.filter((n) => questionsForNode(n.id).length === 0);
    expect(uncovered.map((n) => n.id)).toEqual([]);
  });

  it("даёт не меньше 3 заданий на каждом узле позвоночника", () => {
    for (const id of BACKBONE) {
      expect(questionsForNode(id).length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it("не содержит заданий с совпадающими вариантами ответа", () => {
    for (const q of questions) {
      expect(new Set(q.options).size, q.id).toBe(q.options.length);
    }
  });

  it("оставляет разбор верного варианта пустым, а дистракторов — заполненным", () => {
    for (const q of questions) {
      expect(q.misconception[q.correctIndex], q.id).toBe("");
      const annotated = q.misconception.filter((m, i) => i !== q.correctIndex && m.trim());
      expect(annotated.length, q.id).toBeGreaterThan(0);
    }
  });

  it("держит misconceptionTags согласованными с вариантами", () => {
    for (const q of questions) {
      if (!q.misconceptionTags) continue;
      expect(q.misconceptionTags.length, q.id).toBe(q.options.length);
      expect(q.misconceptionTags[q.correctIndex], q.id).toBe("none");
    }
  });
});

describe("пары на языковой барьер", () => {
  it("есть на каждом узле позвоночника", () => {
    for (const id of BACKBONE) expect(hasLanguagePair(id), id).toBe(true);
  });

  it("связывают ровно два задания одного узла — длинное и краткое", () => {
    const paired = questions.filter((q) => q.pairId);
    for (const q of paired) {
      const partner = pairedQuestion(q);
      expect(partner, q.id).toBeDefined();
      expect(partner!.nodeId).toBe(q.nodeId);
      expect(partner!.id).not.toBe(q.id);
      expect(partner!.phrasing).not.toBe(q.phrasing);
    }
  });

  it("делают длинную формулировку действительно длиннее краткой", () => {
    const longOnes = questions.filter((q) => q.phrasing === "long");
    for (const long of longOnes) {
      const short = pairedQuestion(long)!;
      expect(long.text.ru.length, long.id).toBeGreaterThan(short.text.ru.length);
    }
  });

  it("проверяет одно умение: у пары совпадает верный ответ", () => {
    for (const long of questions.filter((q) => q.phrasing === "long")) {
      const short = pairedQuestion(long)!;
      expect(long.options[long.correctIndex], long.id).toBe(short.options[short.correctIndex]);
    }
  });
});

describe("curriculum_chunks.json", () => {
  it("даёт не меньше 5 ru-чанков на каждом узле демо-сценария RAG", () => {
    for (const id of ["frac_operations", "linear_equations", "linear_equations_systems"]) {
      expect(chunksForNode(id, "ru").length, id).toBeGreaterThanOrEqual(5);
    }
  });

  it("покрывает корень демо-сценария казахским — это и есть аргумент RAG", () => {
    const kk = curriculumChunks.filter((c) => c.nodeId === "frac_operations" && c.lang === "kk");
    expect(kk.length).toBeGreaterThanOrEqual(5);
  });

  it("откатывается на ru, если чанков на нужном языке нет", () => {
    const en = chunksForNode("linear_equations", "en");
    expect(en.length).toBeGreaterThan(0);
    expect(en.every((c) => c.lang === "ru")).toBe(true);
  });

  it("у каждого чанка есть источник для маркера «Основано на разделе программы»", () => {
    for (const c of curriculumChunks) expect(c.source.trim().length, c.id).toBeGreaterThan(0);
  });
});

describe("seed_students.json", () => {
  it("содержит 25 профилей", () => {
    expect(seedStudents).toHaveLength(25);
  });

  it("держит корень строго ниже класса ученика", () => {
    for (const s of seedStudents) {
      const root = graph.byId.get(s.rootNodeId)!;
      expect(root.grade, s.id).toBeLessThan(s.grade);
    }
  });

  it("ссылается только на существующие задания и только на неверные ответы", () => {
    for (const s of seedStudents) {
      for (const e of s.errors) {
        const q = questionById(e.questionId);
        expect(q, `${s.id} → ${e.questionId}`).toBeDefined();
        expect(q!.nodeId).toBe(e.nodeId);
        expect(e.chosenIndex).not.toBe(q!.correctIndex);
      }
    }
  });

  it("несёт ИГП, сходящийся с формулой из lib/gdi.ts", () => {
    for (const s of seedStudents) {
      const recomputed = computeGdi(
        computeGdiInputs(graph, {
          studentGrade: s.grade,
          rootNodeId: s.rootNodeId,
          masteredNodeIds: s.masteredNodeIds,
        }),
      );
      expect(Math.abs(recomputed - s.gdi), s.id).toBeLessThan(0.002);
    }
  });

  it("распределён неравномерно: два узла держат минимум 35% класса", () => {
    const counts = [...rootGapCounts().values()].sort((a, b) => b - a);
    const top2 = (counts[0]! + counts[1]!) / seedStudents.length;
    expect(top2).toBeGreaterThanOrEqual(0.35);
  });

  it("даёт перекос именно на узлы дробей", () => {
    const counts = rootGapCounts();
    expect(counts.get("frac_operations")).toBeGreaterThanOrEqual(5);
    expect(counts.get("frac_common_denom")).toBeGreaterThanOrEqual(3);
  });
});

describe("ИГП", () => {
  it("лежит в [0, 1] у всех профилей", () => {
    for (const s of seedStudents) {
      expect(s.gdi, s.id).toBeGreaterThanOrEqual(0);
      expect(s.gdi, s.id).toBeLessThanOrEqual(1);
    }
  });

  it("растёт вместе с глубиной корня", () => {
    const shallow = computeGdi({ depth: 0.2, breadth: 0.3, centrality: 0.4 });
    const deep = computeGdi({ depth: 0.8, breadth: 0.3, centrality: 0.4 });
    expect(deep).toBeGreaterThan(shallow);
  });

  it("разбивается на пороги по спецификации", () => {
    expect(gdiBand(0.2)).toBe("none");
    expect(gdiBand(0.4)).toBe("local");
    expect(gdiBand(0.6)).toBe("deep");
    expect(gdiBand(0.9)).toBe("systemic");
  });

  it("даёт глубину 1 при разрыве в 5 классов и больше", () => {
    const inputs = computeGdiInputs(graph, {
      studentGrade: 8,
      rootNodeId: "natural_numbers",
      masteredNodeIds: [],
    });
    expect(inputs.depth).toBeCloseTo(0.6, 5);
    expect(inputs.breadth).toBe(1);
  });
});
