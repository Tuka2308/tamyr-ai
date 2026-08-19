#!/usr/bin/env tsx
/**
 * Регенерация data/explain-cache.json живой моделью.
 * Запуск: ANTHROPIC_API_KEY=... npm run generate:cache
 *
 * ВАЖНО о происхождении текущего кэша. На момент сборки (22.08.2026) ключа
 * не было, поэтому закоммиченные объяснения написаны командой вручную строго
 * по фрагментам curriculum_chunks.json. Этот скрипт — путь замены их на
 * сгенерированные и проверенные вторым проходом, а не описание того, как они
 * появились. Выдавать ручной текст за машинный мы не будем.
 *
 * Скрипт проходит те же три прохода, что и /api/explain, и записывает только
 * те ответы, которые verification признал заземлёнными.
 */
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import { loadGraph } from "../lib/graph";
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
} from "../lib/rag";
import { chunksForNode } from "../lib/data";
import type { Locale, MisconceptionTag } from "../lib/types";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Нужен ANTHROPIC_API_KEY. Текущий кэш остаётся без изменений.");
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const graph = loadGraph();
const TAGS: MisconceptionTag[] = ["none", "conceptual", "procedural", "careless"];

type Entry = {
  key: string;
  nodeId: string;
  tag: MisconceptionTag;
  locale: Locale;
  sourceIds: string[];
  explanation: string;
};

const entries: Entry[] = [];
const rejected: string[] = [];

for (const node of graph.nodes) {
  if (!hasCurriculum(node.id)) continue;

  // Языки, на которых у узла реально есть чанки. Чужие не выдумываем.
  const locales = (["kk", "ru", "en"] as Locale[]).filter(
    (l) => chunksForNode(node.id, l).some((c) => c.lang === l),
  );

  for (const locale of locales) {
    for (const tag of TAGS) {
      const prose = misconceptionProseFor(node.id, tag);
      if (tag !== "none" && prose === null) continue;

      const retrieval = retrieve(node.id, locale, [node.title[locale], prose ?? ""].join(" "));
      if (retrieval.chunks.length === 0 || retrieval.languageFallback) continue;

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
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      const verification = await client.messages.create({
        model: EXPLAIN_MODEL,
        max_tokens: 2000,
        system: VERIFICATION_SYSTEM_PROMPT,
        output_config: { format: { type: "json_schema", schema: VERIFICATION_SCHEMA } },
        messages: [
          {
            role: "user",
            content: buildVerificationUserPrompt({ chunks: retrieval.chunks, explanation }),
          },
        ],
      });

      const verdict = JSON.parse(
        verification.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
      ) as Verification;

      const key = cacheKey(node.id, tag, locale);

      // В кэш идёт только то, что прошло проверку. Незаземлённое не сохраняем:
      // иначе кэш стал бы способом протащить выдумку мимо verification.
      if (!verdict.grounded) {
        rejected.push(`${key}: ${verdict.unsupported.join(" | ")}`);
        continue;
      }

      entries.push({
        key,
        nodeId: node.id,
        tag,
        locale,
        sourceIds: retrieval.chunks.map((c) => c.id),
        explanation,
      });
      console.log(`  ✓ ${key}`);
    }
  }
}

writeFileSync(
  "data/explain-cache.json",
  JSON.stringify(
    {
      version: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
      note: "Сгенерировано scripts/generate-explain-cache.ts. В кэш попали только ответы, прошедшие verification-проход.",
      entries,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(`\nзаписано ${entries.length} записей, отклонено ${rejected.length}`);
for (const r of rejected) console.log(`  ✗ ${r}`);
