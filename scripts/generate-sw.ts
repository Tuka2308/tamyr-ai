#!/usr/bin/env tsx
/**
 * Собирает public/sw.js. Запуск: npm run generate:sw
 *
 * Список маршрутов узлов берётся из graph.json, а не пишется руками: узлов 75,
 * и рассинхрон между графом и прекэшем заметить было бы невозможно. Файл
 * коммитится — на Vercel public/ загружается как статика на этапе сборки,
 * поэтому генерировать его после next build уже поздно.
 *
 * npm run validate:sw проверяет, что список в sw.js всё ещё совпадает с графом.
 */
import { writeFileSync } from "node:fs";
import { loadGraph } from "../lib/graph";

const graph = loadGraph();
const nodeRoutes = graph.nodes.map((n) => `/node/${n.id}`);

/** Экраны приложения. Все пререндерятся, поэтому кэшируются целиком. */
const APP_ROUTES = [
  "/",
  "/about",
  "/onboarding",
  "/diagnose",
  "/result",
  "/path",
  "/dashboard",
  "/teacher",
];

/**
 * Данные, лежащие в /data. В бандл они уже вшиты сборщиком, но кэшируем и
 * файлы: их читают скрипты и они видны в репозитории как артефакт.
 */
const ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const version = new Date().toISOString().slice(0, 10);

const sw = `/*
 * Service worker TAMYR AI. СГЕНЕРИРОВАН scripts/generate-sw.ts — не править руками.
 * Список узлов синхронизирован с data/graph.json (${graph.nodes.length} узлов).
 *
 * Стратегии:
 *   · навигация            — network-first с откатом в кэш; офлайн отдаём
 *                            сохранённую страницу, а при её отсутствии — «/»
 *   · /_next/static/*      — cache-first: имена хэшированы, содержимое неизменно
 *   · прочие GET того же   — stale-while-revalidate
 *     происхождения
 *   · /api/*               — только сеть, ничего не кэшируем: устаревшее
 *                            объяснение хуже честной заглушки, а клиент и так
 *                            умеет отвечать из локального кэша объяснений
 */

const VERSION = "tamyr-${version}";
const SHELL = VERSION + "-shell";
const RUNTIME = VERSION + "-runtime";

const PRECACHE = ${JSON.stringify([...APP_ROUTES, ...nodeRoutes, ...ASSETS], null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // Кладём по одному: один недоступный адрес не должен рушить всю установку.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) await cache.put(url, response);
          } catch {
            /* адрес недоступен — переживём, подберём в рантайме */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API не кэшируем: лучше честная заглушка, чем протухший ответ модели.
  if (url.pathname.startsWith("/api/")) return;

  // Навигация: сеть, потом кэш, потом корень как последний рубеж.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const root = await caches.match("/");
          if (root) return root;
          return new Response("Офлайн", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  // Неизменяемая статика: сначала кэш.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        const cache = await caches.open(RUNTIME);
        cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Всё остальное: отдаём кэш сразу, обновляем в фоне.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(RUNTIME);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      return cached ?? (await network) ?? new Response("", { status: 504 });
    })(),
  );
});
`;

writeFileSync("public/sw.js", sw, "utf8");
console.log(`public/sw.js собран`);
console.log(`  экранов приложения: ${APP_ROUTES.length}`);
console.log(`  страниц узлов:      ${nodeRoutes.length}`);
console.log(`  прочих ассетов:     ${ASSETS.length}`);
console.log(`  всего в прекэше:    ${APP_ROUTES.length + nodeRoutes.length + ASSETS.length}`);
