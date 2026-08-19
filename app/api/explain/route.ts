import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import cacheFile from "@/data/explain-cache.json";
import chunksFile from "@/data/curriculum_chunks.json";
import { loadGraph } from "@/lib/graph";
import {
  buildGenerationSystemPrompt,
  buildGenerationUserPrompt,
  buildVerificationUserPrompt,
  cacheKey,
  EXPLAIN_MODEL,
  hasCurriculum,
  misconceptionProseFor,
  retrieve,
  VERIFICATION_SCHEMA,
  VERIFICATION_SYSTEM_PROMPT,
  type Verification,
} from "@/lib/rag";
import { DEFAULT_LOCALE, LOCALES, type Locale, type MisconceptionTag } from "@/lib/types";

/* ============================================================================
   /api/explain — объяснение узла, заземлённое на учебную программу.

   Порядок разрешения запроса:

     1. Нет чанков по узлу        → честная заглушка. Не генерируем.
     2. Есть в кэше               → отдаём мгновенно, offline-friendly.
     3. Есть ключ                 → полный тройной проход вживую.
     4. Нет ключа                 → честная заглушка. Не генерируем.

   Пункты 1 и 4 — не деградация, а принцип: лучше сказать «материала нет»,
   чем показать школьнику правдоподобный вымысел. Фолбэк на чанки соседнего
   узла сознательно не делается — это ровно то додумывание, которое
   архитектура запрещает.

   Ключ читается только здесь, на сервере. В клиентский бандл он не попадает:
   имя переменной без префикса NEXT_PUBLIC_, а route handler на клиенте
   не исполняется.
   ============================================================================ */

export const runtime = "nodejs";

type CacheEntry = {
  key: string;
  nodeId: string;
  tag: MisconceptionTag;
  locale: Locale;
  sourceIds: string[];
  explanation: string;
};

const cache = new Map<string, CacheEntry>(
  (cacheFile.entries as unknown as CacheEntry[]).map((e) => [e.key, e]),
);

export type ExplainResponse = {
  /** Что показывать. */
  status: "cached" | "generated" | "chunk_fallback" | "unavailable";
  /**
   * Эхо тега ошибки, под который строилось объяснение. Возвращается, чтобы
   * панель «след ИИ» читала его из ответа, а не пересобирала из локального
   * состояния: показанное там должно быть тем же, чем пользовался бэкенд.
   */
  tag: MisconceptionTag;
  /** Сколько фрагментов программы реально ушло в контекст. */
  retrievedCount: number;
  explanation: string | null;
  /** Подписи «Основано на разделе программы: …». */
  sources: string[];
  /** Язык источников; отличается от locale, когда сработал откат на ru. */
  sourceLang: Locale | null;
  languageFallback: boolean;
  grounded: boolean | null;
  unsupported: string[];
  /** Причина, по которой объяснения нет. */
  reason?: "no_curriculum" | "no_api_key" | "verification_failed" | "error";
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: { nodeId?: string; tag?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Тело запроса не является JSON");
  }

  const graph = loadGraph();
  const nodeId = body.nodeId;
  if (!nodeId || !graph.byId.has(nodeId)) return badRequest("Неизвестный nodeId");

  const locale: Locale = (LOCALES as readonly string[]).includes(body.locale ?? "")
    ? (body.locale as Locale)
    : DEFAULT_LOCALE;
  const tag = (body.tag ?? "none") as MisconceptionTag;
  const node = graph.byId.get(nodeId)!;

  /* --- 1. Материала по узлу нет ------------------------------------------ */
  if (!hasCurriculum(nodeId)) {
    return NextResponse.json<ExplainResponse>({
      status: "unavailable",
      tag,
      retrievedCount: 0,
      explanation: null,
      sources: [],
      sourceLang: null,
      languageFallback: false,
      grounded: null,
      unsupported: [],
      reason: "no_curriculum",
    });
  }

  /* --- 2. Кэш ------------------------------------------------------------- */
  // Сначала точное совпадение по языку, затем русская запись как источник
  // с явной пометкой — интерфейс при этом остаётся на языке пользователя.
  const exact = cache.get(cacheKey(nodeId, tag, locale));
  const fallback = cache.get(cacheKey(nodeId, tag, "ru"));
  const hit = exact ?? fallback;

  if (hit) {
    return NextResponse.json<ExplainResponse>({
      status: "cached",
      tag,
      retrievedCount: hit.sourceIds.length,
      explanation: hit.explanation,
      sources: sourceLabels(hit.sourceIds),
      sourceLang: hit.locale,
      languageFallback: hit.locale !== locale,
      grounded: true,
      unsupported: [],
    });
  }

  /* --- 3. Живой тройной проход ------------------------------------------- */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const prose = misconceptionProseFor(nodeId, tag);
  const query = [node.title[locale], prose ?? ""].join(" ");
  const retrieval = retrieve(nodeId, locale, query);

  if (!apiKey) {
    // Ключа нет — генерировать нечем. Отдаём исходный чанк как есть:
    // это честный материал программы, пусть и не адаптированный.
    const first = retrieval.chunks[0];
    if (!first) {
      return NextResponse.json<ExplainResponse>({
        status: "unavailable",
        tag,
        retrievedCount: 0,
        explanation: null,
        sources: [],
        sourceLang: null,
        languageFallback: false,
        grounded: null,
        unsupported: [],
        reason: "no_curriculum",
      });
    }
    return NextResponse.json<ExplainResponse>({
      status: "chunk_fallback",
      tag,
      retrievedCount: retrieval.chunks.length,
      explanation: first.text,
      sources: [first.source],
      sourceLang: first.lang,
      languageFallback: retrieval.languageFallback,
      grounded: true,
      unsupported: [],
      reason: "no_api_key",
    });
  }

  try {
    const client = new Anthropic({ apiKey });

    // ПРОХОД 2 — GENERATION.
    const generation = await client.messages.create({
      model: EXPLAIN_MODEL,
      max_tokens: 1200,
      system: buildGenerationSystemPrompt({
        locale,
        nodeGrade: node.grade,
        nodeTitle: node.title[locale],
      }),
      messages: [
        {
          role: "user",
          content: buildGenerationUserPrompt({
            chunks: retrieval.chunks,
            misconceptionProse: prose,
          }),
        },
      ],
    });

    const explanation = generation.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!explanation) throw new Error("Пустой ответ генерации");

    // ПРОХОД 3 — VERIFICATION. Отдельный вызов: модель, проверяющая себя
    // внутри того же ответа, склонна подтверждать собственный текст.
    // Структурированный вывод, а не разбор прозы — иначе проверка сама
    // становится источником ошибок.
    const verification = await client.messages.create({
      model: EXPLAIN_MODEL,
      max_tokens: 2000,
      system: VERIFICATION_SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: VERIFICATION_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: buildVerificationUserPrompt({ chunks: retrieval.chunks, explanation }),
        },
      ],
    });

    const raw = verification.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    const verdict = JSON.parse(raw) as Verification;

    // Не прошло проверку — генерацию НЕ показываем. Показываем исходный чанк.
    if (!verdict.grounded) {
      const first = retrieval.chunks[0]!;
      return NextResponse.json<ExplainResponse>({
        status: "chunk_fallback",
        tag,
        retrievedCount: retrieval.chunks.length,
        explanation: first.text,
        sources: [first.source],
        sourceLang: first.lang,
        languageFallback: retrieval.languageFallback,
        grounded: false,
        unsupported: verdict.unsupported ?? [],
        reason: "verification_failed",
      });
    }

    return NextResponse.json<ExplainResponse>({
      status: "generated",
      tag,
      retrievedCount: retrieval.chunks.length,
      explanation,
      sources: retrieval.chunks.map((c) => c.source),
      sourceLang: retrieval.sourceLang,
      languageFallback: retrieval.languageFallback,
      grounded: true,
      unsupported: [],
    });
  } catch (error) {
    // Сеть, лимит, ключ — что угодно. Интерфейс не должен ломаться:
    // отдаём материал программы напрямую.
    console.error("[/api/explain] живой проход не удался:", error);
    const first = retrieval.chunks[0];
    return NextResponse.json<ExplainResponse>({
      status: first ? "chunk_fallback" : "unavailable",
      tag,
      retrievedCount: retrieval.chunks.length,
      explanation: first?.text ?? null,
      sources: first ? [first.source] : [],
      sourceLang: first?.lang ?? null,
      languageFallback: retrieval.languageFallback,
      grounded: first ? true : null,
      unsupported: [],
      reason: "error",
    });
  }
}

const sourceById = new Map(
  (chunksFile.chunks as { id: string; source: string }[]).map((c) => [c.id, c.source]),
);

/** Человекочитаемые подписи источников по их id. */
function sourceLabels(ids: string[]): string[] {
  return ids.map((id) => sourceById.get(id) ?? id);
}
