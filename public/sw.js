/*
 * Service worker TAMYR AI. СГЕНЕРИРОВАН scripts/generate-sw.ts — не править руками.
 * Список узлов синхронизирован с data/graph.json (75 узлов).
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

const VERSION = "tamyr-2026-08-19";
const SHELL = VERSION + "-shell";
const RUNTIME = VERSION + "-runtime";

const PRECACHE = [
  "/",
  "/about",
  "/onboarding",
  "/diagnose",
  "/result",
  "/path",
  "/dashboard",
  "/teacher",
  "/node/natural_numbers",
  "/node/order_of_operations",
  "/node/nat_divisibility",
  "/node/prime_factorization",
  "/node/gcd_lcm",
  "/node/fractions_basic",
  "/node/decimal_basic",
  "/node/decimal_operations",
  "/node/rounding_estimation",
  "/node/units_measure",
  "/node/powers_natural",
  "/node/geometry_intro",
  "/node/angle_measure",
  "/node/perimeter_area_basic",
  "/node/volume_basic",
  "/node/coordinate_ray",
  "/node/text_problems_arithmetic",
  "/node/average_value",
  "/node/data_tables_basic",
  "/node/frac_common_denom",
  "/node/frac_operations",
  "/node/mixed_numbers",
  "/node/frac_decimal_convert",
  "/node/negative_numbers",
  "/node/rational_numbers",
  "/node/rational_operations",
  "/node/ratio_basic",
  "/node/proportion",
  "/node/direct_inverse_proportion",
  "/node/percent_basic",
  "/node/percent_problems",
  "/node/scale_maps",
  "/node/coordinate_plane",
  "/node/circle_circumference",
  "/node/symmetry",
  "/node/divisibility_advanced",
  "/node/simple_equations_6",
  "/node/probability_intro",
  "/node/linear_expressions",
  "/node/linear_equations",
  "/node/monomials",
  "/node/polynomials",
  "/node/polynomial_multiply",
  "/node/abbreviated_multiplication",
  "/node/factorization",
  "/node/integer_powers",
  "/node/standard_form_numbers",
  "/node/function_concept",
  "/node/linear_function",
  "/node/linear_function_graphs",
  "/node/word_problems_equations",
  "/node/triangles_basic",
  "/node/parallel_lines",
  "/node/triangle_angles_sum",
  "/node/isosceles_triangle",
  "/node/statistics_basic",
  "/node/linear_equations_systems",
  "/node/algebraic_fractions",
  "/node/algebraic_fractions_operations",
  "/node/square_root",
  "/node/sqrt_properties",
  "/node/quadratic_equations",
  "/node/vieta_theorem",
  "/node/quadratic_function",
  "/node/inequalities_linear",
  "/node/inequality_systems",
  "/node/pythagorean_theorem",
  "/node/similar_triangles",
  "/node/quadrilaterals",
  "/node/area_polygons",
  "/node/trigonometry_intro",
  "/node/rational_equations",
  "/node/word_problems_systems",
  "/node/statistics_grouped",
  "/node/probability_classic",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png"
];

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
