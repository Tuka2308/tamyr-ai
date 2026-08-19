import { describe, expect, it } from "vitest";
import {
  cacheKey,
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
  buildVerificationUserPrompt,
  hasCurriculum,
  misconceptionProseFor,
  retrieve,
  VERIFICATION_SCHEMA,
} from "./rag";
import cacheFile from "../data/explain-cache.json";
import { loadGraph } from "./graph";

const graph = loadGraph();
const CHUNKED = ["frac_operations", "linear_equations", "linear_equations_systems"];

describe("retrieval", () => {
  it("отдаёт только чанки запрошенного узла", () => {
    const { chunks } = retrieve("frac_operations", "ru", "сложение дробей");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.nodeId === "frac_operations")).toBe(true);
  });

  it("ранжирует лексически: релевантный чанк поднимается наверх", () => {
    const { chunks } = retrieve("frac_operations", "ru", "деление обратная дробь делитель");
    expect(chunks[0]!.text).toContain("Деление на дробь");
  });

  it("отдаёт казахские чанки для kk без отката", () => {
    const r = retrieve("frac_operations", "kk", "бөлшектерді қосу");
    expect(r.sourceLang).toBe("kk");
    expect(r.languageFallback).toBe(false);
  });

  it("откатывается на ru и ЧЕСТНО помечает это флагом", () => {
    const r = retrieve("linear_equations", "kk", "теңдеу");
    expect(r.sourceLang).toBe("ru");
    expect(r.languageFallback).toBe(true);
  });

  it("возвращает пусто там, где чанков нет вовсе", () => {
    const r = retrieve("scale_maps", "ru", "масштаб");
    expect(r.chunks).toHaveLength(0);
    expect(r.sourceLang).toBeNull();
  });

  it("никогда не подмешивает чанки соседнего узла", () => {
    for (const node of graph.nodes) {
      const { chunks } = retrieve(node.id, "ru", node.title.ru);
      expect(chunks.every((c) => c.nodeId === node.id), node.id).toBe(true);
    }
  });
});

describe("hasCurriculum", () => {
  it("истинно ровно для трёх чанкованных узлов", () => {
    const withCurriculum = graph.nodes.filter((n) => hasCurriculum(n.id)).map((n) => n.id);
    expect(withCurriculum.sort()).toEqual([...CHUNKED].sort());
  });

  it("ложно для несуществующего узла", () => {
    expect(hasCurriculum("ghost")).toBe(false);
  });
});

describe("промпты", () => {
  const system = buildGenerationSystemPrompt({
    locale: "kk",
    nodeGrade: 6,
    nodeTitle: "Жай бөлшектерге амалдар қолдану",
  });

  it("запрещают выходить за пределы переданных фрагментов", () => {
    expect(system).toContain("ТОЛЬКО");
    expect(system).toContain("не додумывай");
  });

  it("требуют признать нехватку данных вместо догадки", () => {
    expect(system).toContain("не хватает");
  });

  it("задают язык пользователя", () => {
    expect(system).toContain("казахском");
  });

  it("задают уровень КЛАССА УЗЛА, а не класса ученика", () => {
    expect(system).toContain("6 класса");
    expect(system).toContain("не класс ученика");
  });

  it("вкладывают источники в пользовательский промпт", () => {
    const { chunks } = retrieve("frac_operations", "ru", "дроби");
    const prompt = buildGenerationUserPrompt({ chunks, misconceptionProse: "Сложил знаменатели." });
    expect(prompt).toContain("Источник:");
    expect(prompt).toContain("Ошибка ученика");
  });

  it("верификатор получает и фрагменты, и проверяемый текст", () => {
    const { chunks } = retrieve("frac_operations", "ru", "дроби");
    const prompt = buildVerificationUserPrompt({ chunks, explanation: "Текст для проверки" });
    expect(prompt).toContain("Текст для проверки");
    expect(prompt).toContain(chunks[0]!.text.slice(0, 40));
  });

  it("схема верификации требует оба поля и запрещает лишние", () => {
    expect(VERIFICATION_SCHEMA.required).toEqual(["grounded", "unsupported"]);
    expect(VERIFICATION_SCHEMA.additionalProperties).toBe(false);
  });
});

describe("misconceptionProseFor", () => {
  it("находит прозу по тегу", () => {
    expect(misconceptionProseFor("frac_operations", "conceptual")).toContain("числители");
  });

  it("возвращает null для none и unknown", () => {
    expect(misconceptionProseFor("frac_operations", "none")).toBeNull();
    expect(misconceptionProseFor("frac_operations", "unknown")).toBeNull();
  });

  it("никогда не возвращает разбор верного варианта", () => {
    for (const node of graph.nodes) {
      for (const tag of ["conceptual", "procedural", "careless"] as const) {
        const prose = misconceptionProseFor(node.id, tag);
        if (prose !== null) expect(prose.length, node.id).toBeGreaterThan(0);
      }
    }
  });
});

describe("кэш объяснений", () => {
  const entries = cacheFile.entries as { key: string; nodeId: string; explanation: string; sourceIds: string[] }[];

  it("покрывает все три чанкованных узла", () => {
    expect(new Set(entries.map((e) => e.nodeId))).toEqual(new Set(CHUNKED));
  });

  it("никогда не ссылается на узлы без чанков", () => {
    for (const e of entries) expect(hasCurriculum(e.nodeId), e.key).toBe(true);
  });

  it("у каждой записи есть источник для маркера", () => {
    for (const e of entries) expect(e.sourceIds.length, e.key).toBeGreaterThan(0);
  });

  it("ключи совпадают с cacheKey", () => {
    for (const e of entries) {
      const parts = e.key.split("::");
      expect(cacheKey(parts[0]!, parts[1] as never, parts[2] as never)).toBe(e.key);
    }
  });
});
