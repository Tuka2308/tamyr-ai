"use client";

import cacheFile from "../data/explain-cache.json";
import type { ExplainResponse } from "../app/api/explain/route";
import { cacheKey } from "./rag";
import type { Locale, MisconceptionTag } from "./types";
import chunksFile from "../data/curriculum_chunks.json";

/* ============================================================================
   Клиентское разрешение объяснений.

   Кэш проверяется В БРАУЗЕРЕ, до всякого сетевого вызова. Две причины:

   1. Офлайн. /api/explain — серверный маршрут; при выключенном интернете
      он недоступен, и экран узла остался бы пустым. Требование дня 7 —
      демо работает офлайн, — этим и закрывается, без service worker и
      без попыток кэшировать POST-ответы.

   2. Задержка. На защите объяснение появляется мгновенно, без похода
      на сервер и без двух вызовов модели.

   Сеть остаётся нужна только для кэш-промаха, то есть для узлов и тегов,
   которых в предзаготовке нет. Там полный тройной проход отрабатывает
   на сервере как обычно.
   ============================================================================ */

type CacheEntry = {
  key: string;
  nodeId: string;
  tag: MisconceptionTag;
  locale: Locale;
  sourceIds: string[];
  explanation: string;
};

const entries = cacheFile.entries as unknown as CacheEntry[];
const byKey = new Map(entries.map((e) => [e.key, e]));
const nodesWithCurriculum = new Set(
  (chunksFile.chunks as { nodeId: string }[]).map((c) => c.nodeId),
);
const sourceById = new Map(
  (chunksFile.chunks as { id: string; source: string }[]).map((c) => [c.id, c.source]),
);

function fromCache(nodeId: string, tag: MisconceptionTag, locale: Locale): ExplainResponse | null {
  // Точное совпадение по языку, затем русская запись с честной пометкой.
  const hit = byKey.get(cacheKey(nodeId, tag, locale)) ?? byKey.get(cacheKey(nodeId, tag, "ru"));
  if (!hit) return null;

  return {
    status: "cached",
    tag,
    retrievedCount: hit.sourceIds.length,
    explanation: hit.explanation,
    sources: hit.sourceIds.map((id) => sourceById.get(id) ?? id),
    sourceLang: hit.locale,
    languageFallback: hit.locale !== locale,
    grounded: true,
    unsupported: [],
  };
}

export async function explain(
  nodeId: string,
  tag: MisconceptionTag,
  locale: Locale,
): Promise<ExplainResponse> {
  // 1. Материала по узлу нет — отвечаем сразу, сеть не трогаем.
  if (!nodesWithCurriculum.has(nodeId)) {
    return {
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
    };
  }

  // 2. Кэш.
  const cached = fromCache(nodeId, tag, locale);
  if (cached) return cached;

  // 3. Промах — идём на сервер за живым тройным проходом.
  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, tag, locale }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ExplainResponse;
  } catch {
    // Офлайн или сервер недоступен. Заглушка, а не пустой экран.
    return {
      status: "unavailable",
      tag,
      retrievedCount: 0,
      explanation: null,
      sources: [],
      sourceLang: null,
      languageFallback: false,
      grounded: null,
      unsupported: [],
      reason: "error",
    };
  }
}
