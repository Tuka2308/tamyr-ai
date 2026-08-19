#!/usr/bin/env tsx
/**
 * Проверяет, что прекэш service worker не разошёлся с графом и маршрутами.
 * Запуск: npm run validate:sw (подключён к сборке).
 *
 * Рассинхрон здесь тихий и вредный: узел добавили, sw.js не пересобрали —
 * страница просто не откроется офлайн, и заметить это можно только вручную.
 */
import { readFileSync } from "node:fs";
import { loadGraph } from "../lib/graph";

const graph = loadGraph();
const errors: string[] = [];

let sw: string;
try {
  sw = readFileSync("public/sw.js", "utf8");
} catch {
  console.error("public/sw.js не найден. Соберите: npm run generate:sw");
  process.exit(1);
}

const match = sw.match(/const PRECACHE = (\[[\s\S]*?\]);/);
if (!match) {
  console.error("В public/sw.js не найден список PRECACHE");
  process.exit(1);
}

const precache = new Set(JSON.parse(match[1]!) as string[]);

const REQUIRED_ROUTES = [
  "/", "/about", "/onboarding", "/diagnose", "/result", "/path", "/dashboard", "/teacher",
];

for (const route of REQUIRED_ROUTES) {
  if (!precache.has(route)) errors.push(`[маршрут] «${route}» не попал в прекэш`);
}

for (const node of graph.nodes) {
  if (!precache.has(`/node/${node.id}`)) {
    errors.push(`[узел] «/node/${node.id}» не попал в прекэш — офлайн не откроется`);
  }
}

// Лишние маршруты узлов — признак того, что узел удалили, а sw.js не пересобрали.
const known = new Set(graph.nodes.map((n) => `/node/${n.id}`));
for (const entry of precache) {
  if (entry.startsWith("/node/") && !known.has(entry)) {
    errors.push(`[узел] «${entry}» есть в прекэше, но такого узла в графе нет`);
  }
}

if (!precache.has("/manifest.webmanifest")) errors.push("[pwa] манифест не в прекэше");
if (!sw.includes('url.pathname.startsWith("/api/")')) {
  errors.push("[pwa] нет правила «API не кэшируем» — можно отдать протухшее объяснение");
}

if (errors.length > 0) {
  console.error(`\nservice worker НЕ ПРОШЁЛ проверку — ошибок: ${errors.length}\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("\n  Пересоберите: npm run generate:sw\n");
  process.exit(1);
}

console.log("service worker — проверка пройдена");
console.log(`  прекэш: ${precache.size} адресов`);
console.log(`  экранов ${REQUIRED_ROUTES.length}, узлов ${graph.nodes.length}, API не кэшируется`);
console.log("");
