/*
 * Проверка пунктов QA-чек-листа, которые нельзя проверить curl-ом:
 * клавиатурная навигация, видимый фокус, prefers-reduced-motion,
 * текст для скринридера, смена <html lang>, ширина 1440px.
 *
 * Запуск: npm run test:a11y   (BASE_URL — против прода)
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3181";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const results = [];
const ok = (n, c, d = "") => results.push({ n, pass: c, d });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", args: ["--no-sandbox"] });

// ---------- Клавиатура ----------
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.goto(BASE + "/onboarding", { waitUntil: "networkidle0" });
await sleep(400);
let reached = 0;
let focusVisible = 0;
for (let i = 0; i < 25; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    return { tag: el.tagName.toLowerCase(), outline };
  });
  if (info) { reached++; if (info.outline) focusVisible++; }
}
ok(`Tab доходит до интерактивных элементов (${reached})`, reached >= 8);
ok(`видимый фокус есть у всех достигнутых (${focusVisible}/${reached})`, focusVisible === reached);

// Пройти онбординг только клавиатурой
await page.goto(BASE + "/onboarding", { waitUntil: "networkidle0" });
await sleep(300);
let advanced = false;
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("Tab");
  const isNext = await page.evaluate(() =>
    /Әрі қарай|Дальше|Next/.test(document.activeElement?.textContent ?? ""));
  if (isNext) { await page.keyboard.press("Enter"); advanced = true; break; }
}
ok("онбординг управляется с клавиатуры", advanced);

// Варианты ответа достижимы клавиатурой
await page.goto(BASE + "/diagnose", { waitUntil: "networkidle0" });
await sleep(600);
let optionFocused = false;
for (let i = 0; i < 30; i++) {
  await page.keyboard.press("Tab");
  optionFocused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-pressed") !== null);
  if (optionFocused) break;
}
ok("варианты ответа достижимы клавиатурой", optionFocused);

// ---------- prefers-reduced-motion ----------
const rm = await browser.newPage();
await rm.setViewport({ width: 1440, height: 900 });
await rm.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
// Главная: корневой узел «Разреза» помечен .node-root всегда, без прохождения
// диагностики. На /diagnose пульсирующий узел появляется только после спуска.
await rm.goto(BASE + "/", { waitUntil: "networkidle0" });
await sleep(700);
const motion = await rm.evaluate(() => {
  const node = document.querySelector(".node-root, .node-testing");
  if (!node) return { found: false, duration: null, outline: null };
  const cs = getComputedStyle(node);
  return {
    found: true,
    duration: cs.animationDuration,
    iterations: cs.animationIterationCount,
    outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
  };
});
ok(
  "prefers-reduced-motion: анимация выключена",
  motion.found && parseFloat(motion.duration) < 0.01,
  motion.found ? `${motion.duration}, повторов ${motion.iterations}` : "анимируемый узел не найден",
);
ok("prefers-reduced-motion: остаётся статичная обводка", motion.found && motion.outline === true);
await rm.close();

// Контроль: без reduced-motion анимация обязана работать, иначе первая
// проверка проходила бы просто потому, что анимации нет вообще.
const normal = await browser.newPage();
await normal.setViewport({ width: 1440, height: 900 });
await normal.goto(BASE + "/", { waitUntil: "networkidle0" });
await sleep(700);
const normalMotion = await normal.evaluate(() => {
  const node = document.querySelector(".node-root, .node-testing");
  return node ? getComputedStyle(node).animationDuration : null;
});
ok("контроль: без reduced-motion анимация включена", normalMotion !== null && parseFloat(normalMotion) > 0.5, String(normalMotion));
await normal.close();

// ---------- Скринридер: тепловая карта ----------
const sr = await browser.newPage();
await sr.setViewport({ width: 1440, height: 900 });
await sr.goto(BASE + "/teacher", { waitUntil: "networkidle0" });
await sleep(700);
const heat = await sr.evaluate(() => {
  const cells = [...document.querySelectorAll("td")];
  const withText = cells.filter((c) => (c.querySelector(".sr-only")?.textContent ?? "").trim().length > 0);
  return {
    cells: cells.length,
    described: withText.length,
    caption: (document.querySelector("caption")?.textContent ?? "").trim().length > 0,
    rowHeaders: document.querySelectorAll('th[scope="row"]').length,
    colHeaders: document.querySelectorAll('th[scope="col"]').length,
  };
});
ok(`каждая клетка карты описана для скринридера (${heat.described}/${heat.cells})`,
   heat.cells > 0 && heat.described === heat.cells);
ok("у таблицы есть caption и заголовки строк/колонок", heat.caption && heat.rowHeaders > 0 && heat.colHeaders > 0,
   `caption=${heat.caption} rows=${heat.rowHeaders} cols=${heat.colHeaders}`);

// ---------- Смена языка меняет <html lang> ----------
await sr.goto(BASE + "/", { waitUntil: "networkidle0" });
await sleep(400);
const langBefore = await sr.evaluate(() => document.documentElement.lang);
await sr.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "ru");
  b?.click();
});
await sleep(500);
const langAfter = await sr.evaluate(() => document.documentElement.lang);
ok(`переключатель меняет <html lang> (${langBefore} → ${langAfter})`, langBefore === "kk" && langAfter === "ru");

// ---------- 1440px ----------
for (const route of ["/", "/diagnose", "/result", "/teacher"]) {
  await sr.goto(BASE + route, { waitUntil: "networkidle0" });
  await sleep(500);
  const wide = await sr.evaluate(() => {
    // Меряем только абзацы с ДЛИННЫМ текстом: у коротких подписей ширина
    // блока ничего не говорит о читаемости строки.
    const longParagraphs = [...document.querySelectorAll("p")]
      .filter((p) => (p.textContent ?? "").trim().length > 120)
      .map((p) => ({ w: p.getBoundingClientRect().width, text: (p.textContent ?? "").slice(0, 40) }));
    const widest = longParagraphs.sort((a, b) => b.w - a.w)[0] ?? null;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      widest,
      count: longParagraphs.length,
    };
  });
  ok(`1440px без горизонтального скролла: ${route}`, wide.overflow <= 1, `overflow ${wide.overflow}px`);
  ok(
    `1440px длинные абзацы читаемой ширины: ${route}`,
    wide.widest === null || wide.widest.w <= 900,
    wide.widest ? `${Math.round(wide.widest.w)}px — «${wide.widest.text}…»` : "длинных абзацев нет",
  );
}

await browser.close();

const pass = results.filter((r) => r.pass).length;
console.log(`\n${"=".repeat(64)}`);
for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.n}${r.d ? "   — " + r.d : ""}`);
console.log(`${"=".repeat(64)}`);
console.log(`  ПРОЙДЕНО ${pass} из ${results.length}`);
process.exit(pass === results.length ? 0 : 1);
