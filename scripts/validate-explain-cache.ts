#!/usr/bin/env tsx
/**
 * Офлайн-проверка заземления кэша объяснений. Запуск: npm run validate:cache
 *
 * Это детерминированный аналог verification-прохода: живой проход спрашивает
 * модель, здесь мы проверяем машинно то, что вообще можно проверить машинно —
 * числа и формулы. Именно они являются главным риском галлюцинации в
 * математическом объяснении: выдуманный пример выглядит убедительно и его
 * невозможно заметить на глаз.
 *
 * Каждое число и каждая формула из объяснения обязаны встречаться в
 * перечисленных источниках. Не встречается — значит текст сообщает школьнику
 * то, чего в программе нет, и запись не принимается.
 */
import cacheFile from "../data/explain-cache.json";
import chunksFile from "../data/curriculum_chunks.json";
import { cacheKey, hasCurriculum, misconceptionProseFor } from "../lib/rag";
import { loadGraph } from "../lib/graph";
import { LOCALES, type CurriculumChunk, type Locale, type MisconceptionTag } from "../lib/types";

type Entry = {
  key: string;
  nodeId: string;
  tag: MisconceptionTag;
  locale: Locale;
  sourceIds: string[];
  explanation: string;
};

const graph = loadGraph();
const entries = cacheFile.entries as unknown as Entry[];
const chunks = chunksFile.chunks as unknown as CurriculumChunk[];
const chunkById = new Map(chunks.map((c) => [c.id, c]));

const errors: string[] = [];
const warnings: string[] = [];
const MAX_WORDS = 160;

/** Числа и математические выражения: 1/2, 3/6, 15/8, 5x, 2x, 14, 6. */
function mathTokens(text: string): string[] {
  const tokens = text.match(/\d+\s*\/\s*\d+|\d+[a-zA-Zа-яА-Я]?|[a-z]\s*[+\-−]\s*\d+/g) ?? [];
  return [...new Set(tokens.map((t) => t.replace(/\s+/g, "")))];
}

/** Нормализация: минусы, дефисы и падежные хвосты чисел не должны мешать сверке. */
function normalize(text: string): string {
  return text
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

for (const entry of entries) {
  if (!graph.byId.has(entry.nodeId)) {
    errors.push(`[${entry.key}] узла «${entry.nodeId}» нет в графе`);
    continue;
  }
  if (!(LOCALES as readonly string[]).includes(entry.locale)) {
    errors.push(`[${entry.key}] неизвестный язык «${entry.locale}»`);
  }
  if (entry.key !== cacheKey(entry.nodeId, entry.tag, entry.locale)) {
    errors.push(`[${entry.key}] ключ не совпадает с тройкой узел/тег/язык`);
  }
  if (entry.sourceIds.length === 0) {
    errors.push(`[${entry.key}] нет источников — маркер «Основано на разделе» показать нечем`);
  }

  const sources = entry.sourceIds.map((id) => chunkById.get(id));
  for (const [i, chunk] of sources.entries()) {
    if (!chunk) {
      errors.push(`[${entry.key}] источник «${entry.sourceIds[i]}» не найден в чанках`);
      continue;
    }
    if (chunk.nodeId !== entry.nodeId) {
      errors.push(`[${entry.key}] источник «${chunk.id}» принадлежит узлу «${chunk.nodeId}»`);
    }
    if (chunk.lang !== entry.locale) {
      errors.push(`[${entry.key}] источник «${chunk.id}» на языке ${chunk.lang}, а запись на ${entry.locale}`);
    }
  }

  const corpus = normalize(
    sources
      .filter((c): c is CurriculumChunk => Boolean(c))
      .map((c) => c.text)
      .join(" "),
  );

  // Главная проверка: ни одного числа мимо источников.
  const ungrounded = mathTokens(entry.explanation).filter(
    (token) => !corpus.includes(normalize(token)),
  );
  if (ungrounded.length > 0) {
    errors.push(`[${entry.key}] числа/формулы вне источников: ${ungrounded.join(", ")}`);
  }

  const words = entry.explanation.split(/\s+/).length;
  if (words > MAX_WORDS) {
    warnings.push(`[${entry.key}] длинное объяснение: ${words} слов`);
  }
  if (entry.explanation.trim().length === 0) {
    errors.push(`[${entry.key}] пустое объяснение`);
  }
}

// Покрытие: у каждого чанкованного узла должна быть запись на каждый тег,
// который реально встречается среди его дистракторов, плюс запись без ошибки.
const covered = new Set(entries.map((e) => e.key));
for (const node of graph.nodes) {
  if (!hasCurriculum(node.id)) continue;
  const tags: MisconceptionTag[] = ["none", "conceptual", "procedural", "careless"];
  for (const tag of tags) {
    if (tag !== "none" && misconceptionProseFor(node.id, tag) === null) continue;
    if (!covered.has(cacheKey(node.id, tag, "ru"))) {
      errors.push(`[покрытие] нет ru-записи для ${node.id} / ${tag}`);
    }
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);

if (errors.length > 0) {
  console.error(`\nКэш объяснений НЕ ПРОШЁЛ проверку — ошибок: ${errors.length}\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("");
  process.exit(1);
}

const byNode = new Map<string, number>();
for (const e of entries) byNode.set(e.nodeId, (byNode.get(e.nodeId) ?? 0) + 1);

console.log("кэш объяснений — проверка заземления пройдена\n");
console.log(`  записей: ${entries.length}`);
for (const [nodeId, count] of byNode) {
  const langs = [...new Set(entries.filter((e) => e.nodeId === nodeId).map((e) => e.locale))];
  console.log(`    ${nodeId.padEnd(26)} ${count} (${langs.join(", ")})`);
}
console.log(`  все числа и формулы прослежены до источников`);
console.log("");
