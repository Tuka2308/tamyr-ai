import { describe, expect, it } from "vitest";
import { buildAiTrace, targetsMisconception } from "./ai-trace";
import type { ExplainResponse } from "../app/api/explain/route";

function response(patch: Partial<ExplainResponse> = {}): ExplainResponse {
  return {
    status: "cached",
    tag: "conceptual",
    retrievedCount: 2,
    explanation: "Текст объяснения",
    sources: ["Математика, 6 класс, §14.1", "Математика, 6 класс, §14.2"],
    sourceLang: "ru",
    languageFallback: false,
    grounded: true,
    unsupported: [],
    ...patch,
  };
}

describe("след ИИ читает реальный ответ, а не показывает статичный текст", () => {
  it("число фрагментов берётся из ответа, а не зашито", () => {
    const two = buildAiTrace(response({ retrievedCount: 2 }));
    const five = buildAiTrace(response({ retrievedCount: 5 }));

    expect(two.find((i) => i.step === "retrieval")!.value).toBe(2);
    expect(five.find((i) => i.step === "retrieval")!.value).toBe(5);
  });

  it("перечисляет реальные источники retrieval", () => {
    const trace = buildAiTrace(response());
    expect(trace.find((i) => i.step === "retrieval")!.details).toEqual([
      "Математика, 6 класс, §14.1",
      "Математика, 6 класс, §14.2",
    ]);
  });

  it("показывает конкретный тег ошибки, под который строилось объяснение", () => {
    for (const tag of ["conceptual", "procedural", "careless"] as const) {
      const trace = buildAiTrace(response({ tag }));
      expect(trace.find((i) => i.step === "generation")!.value).toBe(tag);
    }
  });

  it("при grounded=true и grounded=false даёт РАЗНЫЙ вывод", () => {
    const ok = buildAiTrace(response({ grounded: true }));
    const bad = buildAiTrace(response({ grounded: false, unsupported: ["Выдуманное утверждение."] }));

    const okStep = ok.find((i) => i.step === "verification")!;
    const badStep = bad.find((i) => i.step === "verification")!;

    expect(okStep.value).toBe(true);
    expect(okStep.tone).toBe("good");
    expect(badStep.value).toBe(false);
    expect(badStep.tone).toBe("bad");
    expect(okStep.tone).not.toBe(badStep.tone);
  });

  it("перечисляет неподтверждённые утверждения, когда проверка не пройдена", () => {
    const trace = buildAiTrace(
      response({ grounded: false, unsupported: ["Дроби всегда сокращаются до 1."] }),
    );
    expect(trace.find((i) => i.step === "verification")!.details).toEqual([
      "Дроби всегда сокращаются до 1.",
    ]);
  });

  it("отличает кэш от живой генерации и от отката на фрагмент", () => {
    const statuses = ["cached", "generated", "chunk_fallback"] as const;
    const values = statuses.map(
      (status) => buildAiTrace(response({ status }))!.find((i) => i.step === "origin")!.value,
    );
    expect(values).toEqual([...statuses]);
    expect(new Set(values).size).toBe(3);
  });

  it("помечает откат на исходный фрагмент как предупреждение", () => {
    const trace = buildAiTrace(response({ status: "chunk_fallback", reason: "verification_failed" }));
    const origin = trace.find((i) => i.step === "origin")!;
    expect(origin.tone).toBe("warn");
    expect(origin.details).toContain("verification_failed");
  });

  it("не показывает след там, где объяснения нет вовсе", () => {
    expect(buildAiTrace(response({ status: "unavailable" }))).toEqual([]);
    expect(buildAiTrace(null)).toEqual([]);
  });

  it("два разных ответа дают разный след — панель не может быть заглушкой", () => {
    const a = buildAiTrace(response({ retrievedCount: 2, tag: "conceptual", grounded: true }));
    const b = buildAiTrace(
      response({ retrievedCount: 5, tag: "careless", grounded: false, status: "chunk_fallback" }),
    );
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("targetsMisconception", () => {
  it("истинно для конкретной ошибки", () => {
    expect(targetsMisconception(response({ tag: "procedural" }))).toBe(true);
  });

  it("ложно, когда ошибки не было", () => {
    expect(targetsMisconception(response({ tag: "none" }))).toBe(false);
    expect(targetsMisconception(response({ tag: "unknown" }))).toBe(false);
    expect(targetsMisconception(null)).toBe(false);
  });
});
