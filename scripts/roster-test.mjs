/*
 * Сквозная проверка списка учеников у учителя.
 *
 * Запуск: npm run test:roster   (BASE_URL — против прода)
 *
 * Проверяет то, ради чего фича делалась: ученик регистрируется, проходит
 * диагностику и САМ появляется у учителя — без действий учителя и без
 * перезапуска приложения. Плюс доступность списка и пустое состояние.
 */
import puppeteer from "puppeteer-core";
import { cleanupTestStudents, countTestStudents } from "./cleanup-test-students.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3211";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const results = [];
const errors = [];
const ok = (n, c, d = "") => results.push({ n, pass: c, d });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NAME = `Тест ${Date.now().toString(36).slice(-5)}`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

const text = () => page.evaluate(() => document.body.innerText);
const clickText = (re) =>
  page.evaluate((src) => {
    const rx = new RegExp(src);
    const el = [...document.querySelectorAll("button, a")].find((x) => rx.test(x.textContent ?? ""));
    if (!el) return false;
    el.click();
    return true;
  }, re.source);

/* ---------- Список до регистрации ---------- */
await page.goto(BASE + "/teacher", { waitUntil: "networkidle0" });
await sleep(600);
const before = await text();
ok("список учеников есть на панели", /Ученики|Оқушылар|Students/i.test(before));
ok("демо-класс подписан как демо", /Демо-класс|Демо-сынып|Demo class/i.test(before));
const liveCountBefore = await page.evaluate(() =>
  document.querySelectorAll('a[href^="/teacher/"]').length);

/* ---------- Регистрация и диагностика ---------- */
await page.goto(BASE + "/onboarding", { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await sleep(500);

const hasNameField = await page.evaluate(() => Boolean(document.querySelector('input[autocomplete="given-name"]')));
ok("поле имени на первом шаге онбординга", hasNameField);

await page.type('input[autocomplete="given-name"]', NAME);
for (let i = 0; i < 4; i++) {
  await clickText(/Әрі қарай|Дальше|Next|Диагностиканы бастау|Начать диагностику|Start the diagnosis/);
  await sleep(400);
}
await sleep(900);
ok("онбординг с именем довёл до диагностики", page.url().includes("/diagnose"));

const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("tamyr.profile") ?? "{}"));
ok("профилю присвоен id", typeof profile.id === "string" && profile.id.length > 8, profile.id?.slice(0, 12));
ok("имя сохранено в профиле", profile.name === undefined ? false : profile.name.length > 0, profile.name);

let steps = 0;
while (steps < 18 && !page.url().includes("/result")) {
  const picked = await page.evaluate(() => {
    const opts = [...document.querySelectorAll("button[aria-pressed]")];
    if (opts.length === 0) return false;
    opts[Math.min(1, opts.length - 1)].click();
    return true;
  });
  if (!picked) break;
  await sleep(140);
  if (!(await clickText(/Жауапты тексеру|Проверить ответ|Check the answer/))) break;
  steps++;
  await sleep(260);
}
await sleep(2500);
ok(`диагностика пройдена (${steps} шагов)`, page.url().includes("/result"));

/* ---------- Ученик появился у учителя САМ ---------- */
await page.goto(BASE + "/teacher", { waitUntil: "networkidle0" });
await sleep(900);
const after = await text();
ok("новый ученик появился в списке учителя", after.includes(NAME), NAME);
ok("он помечен как реальный", /Реальные ученики|Нақты оқушылар|Real students/i.test(after));

const liveCountAfter = await page.evaluate(() =>
  document.querySelectorAll('a[href^="/teacher/"]').length);
ok(`список вырос (${liveCountBefore} → ${liveCountAfter})`, liveCountAfter > liveCountBefore);

/* ---------- Кабинет ученика ---------- */
const opened = await page.evaluate((name) => {
  const link = [...document.querySelectorAll('a[href^="/teacher/"]')]
    .find((a) => (a.textContent ?? "").includes(name));
  if (!link) return null;
  const href = link.getAttribute("href");
  link.click();
  return href;
}, NAME);
await sleep(1500);
ok("клик по ученику открывает его кабинет", page.url().includes("/teacher/") && opened !== null);

const view = await text();
ok("в кабинете видно имя ученика", view.includes(NAME));
ok("виден корень и ИГП", /Корневой пробел|Түбірлік олқылық|Root gap/i.test(view) && /ИГП|ОТИ|GDI/.test(view));
ok("подписано «только просмотр»", /только просмотр|тек оқу|read only/i.test(view));

/* ---------- Демо-профиль подписан на своей странице ---------- */
await page.goto(BASE + "/teacher/s01", { waitUntil: "networkidle0" });
await sleep(700);
const demoView = await text();
// В казахском «профилі», а не «профиль» — проверяем по корню слова.
ok("демо-профиль помечен на своей странице",
   /синтетическ\w* профил\w*|синтетикалық профил\w*|synthetic profile/i.test(demoView));

/* ---------- Доступность списка ---------- */
await page.goto(BASE + "/teacher", { waitUntil: "networkidle0" });
await sleep(700);
const a11y = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a[href^="/teacher/"]')];
  const heading = document.querySelector("#roster-title");
  const section = heading?.closest("section");
  return {
    links: links.length,
    named: links.filter((a) => (a.textContent ?? "").trim().length > 0).length,
    labelled: section?.getAttribute("aria-labelledby") === "roster-title",
    headings: section ? section.querySelectorAll("h3").length : 0,
  };
});
ok(`каждая строка списка — ссылка с текстом (${a11y.named}/${a11y.links})`,
   a11y.links > 0 && a11y.named === a11y.links);
ok("секция списка подписана для скринридера", a11y.labelled);
ok("группы «реальные» и «демо» — отдельные заголовки", a11y.headings >= 2, String(a11y.headings));

let tabbed = 0, focusVisible = 0;
await page.evaluate(() => document.querySelector("#roster-title")?.scrollIntoView());
for (let i = 0; i < 60; i++) {
  await page.keyboard.press("Tab");
  const hit = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !(el instanceof HTMLAnchorElement)) return null;
    if (!el.getAttribute("href")?.startsWith("/teacher/")) return null;
    const cs = getComputedStyle(el);
    return { outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 };
  });
  if (hit) { tabbed++; if (hit.outline) focusVisible++; }
  if (tabbed >= 3) break;
}
ok(`строки списка достижимы с клавиатуры (${tabbed})`, tabbed >= 3);
ok(`у них видимый фокус (${focusVisible}/${tabbed})`, tabbed > 0 && focusVisible === tabbed);

ok(`ноль console.error (${errors.length})`, errors.length === 0, errors.slice(0, 2).join(" | "));

/* ---------- Уборка ----------
   И удаление, и подсчёт идут через Blob напрямую, а не через HTTP:
   в API проекта нет ни метода удаления, ни метода чтения списка —
   и то и другое выставляло бы наружу лишнее. Нужен BLOB_READ_WRITE_TOKEN. */
const cleaned = await cleanupTestStudents({ quiet: true });
const leftover = await countTestStudents();
ok(
  `тестовые записи убраны (${cleaned.removed})`,
  !cleaned.skipped && leftover === 0,
  cleaned.skipped ? "нет токена Blob" : `осталось ${leftover}`,
);

await browser.close();

const pass = results.filter((r) => r.pass).length;
console.log(`\n${"=".repeat(66)}`);
for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.n}${r.d ? "   — " + r.d : ""}`);
console.log(`${"=".repeat(66)}`);
console.log(`  ПРОЙДЕНО ${pass} из ${results.length}`);
process.exit(pass === results.length ? 0 : 1);
