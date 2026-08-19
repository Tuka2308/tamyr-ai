/*
 * Реальная офлайн-проверка сквозного пути в настоящем Chrome.
 *
 * Запуск:  npm run build && npx next start -p 3181 &
 *          npm run test:offline
 *          BASE_URL=https://... npm run test:offline   — против прода
 *
 * Проверяет то, что нельзя проверить curl-ом: регистрацию service worker,
 * наполнение прекэша, работу всех экранов при выключенной сети и —
 * главное — выживание навигации после ПЕРЕЗАГРУЗКИ страницы офлайн.
 * Без браузера всё это было бы утверждением на веру.
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3181";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const consoleErrors = [];
const ok = (n, c, d = "") => results.push({ n, pass: c, d });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- ОНЛАЙН: прогрев ----------
await page.goto(BASE + "/", { waitUntil: "networkidle0" });
const swReady = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return Boolean(reg.active);
});
ok("service worker зарегистрирован и активен", swReady);

// Дать install-обработчику докачать прекэш
await sleep(6000);
const cacheInfo = await page.evaluate(async () => {
  const names = await caches.keys();
  let total = 0;
  const perCache = {};
  for (const n of names) { const k = await (await caches.open(n)).keys(); perCache[n] = k.length; total += k.length; }
  return { names, total, perCache };
});
ok(`прекэш заполнен (${cacheInfo.total} записей)`, cacheInfo.total >= 88, JSON.stringify(cacheInfo.perCache));

// Пройти онлайн по экранам, чтобы отработал онбординг и лёг результат
await page.goto(BASE + "/onboarding", { waitUntil: "networkidle0" });
for (let i = 0; i < 4; i++) {
  const btns = await page.$$("button");
  for (const b of btns) {
    const txt = await page.evaluate((e) => e.textContent ?? "", b);
    if (/Әрі қарай|Дальше|Next|Диагностиканы бастау|Начать диагностику|Start the diagnosis/.test(txt)) { await b.click(); break; }
  }
  await sleep(350);
}
await sleep(1200);
ok("онбординг довёл до /diagnose", page.url().includes("/diagnose"), page.url());

// Пройти диагностику: отвечать неверно на всё, кроме дробей 5 класса
let asked = 0;
while (asked < 20) {
  const opts = await page.$$('button[aria-pressed]');
  if (opts.length === 0) break;
  await opts[Math.min(1, opts.length - 1)].click();
  await sleep(120);
  const btns = await page.$$("button");
  let clicked = false;
  for (const b of btns) {
    const txt = await page.evaluate((e) => e.textContent ?? "", b);
    if (/Жауапты тексеру|Проверить ответ|Check the answer/.test(txt)) { await b.click(); clicked = true; break; }
  }
  if (!clicked) break;
  asked++;
  await sleep(200);
  if (page.url().includes("/result")) break;
}
await sleep(1500);
ok(`диагностика завершилась за ${asked} шагов`, asked > 0 && asked <= 16);

await page.goto(BASE + "/result", { waitUntil: "networkidle0" });
const hasResult = await page.evaluate(() => Boolean(localStorage.getItem("tamyr.result")));
ok("результат сохранён в localStorage", hasResult);

// Прогреть остальные экраны онлайн
for (const r of ["/about", "/path", "/dashboard", "/teacher", "/node/frac_operations", "/node/scale_maps"]) {
  await page.goto(BASE + r, { waitUntil: "networkidle0" });
  await sleep(300);
}

// ---------- ОФЛАЙН ----------
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
await page.setOfflineMode(true);
ok("сеть выключена", true);

const screens = [
  ["/", /неліктен|почему|but why|TAMYR/i],
  ["/about", /Жоба туралы|О проекте|About the project/i],
  ["/onboarding", /Бірнеше сұрақ|Несколько вопросов|A few questions/i],
  ["/diagnose", /Осы жерден бастадық|Отсюда начали|We started here/i],
  ["/result", /Түбір табылды|Корень найден|Root found/i],
  ["/path", /Траектория|Path/i],
  ["/dashboard", /Кабинет|Dashboard/i],
  ["/teacher", /Мұғалім панелі|Панель учителя|Teacher panel/i],
  ["/node/frac_operations", /Түсіндірме|Объяснение|Explanation/i],
  ["/node/scale_maps", /Масштаб|Scale/i],
];

for (const [route, re] of screens) {
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 15000 });
    await sleep(700);
    const body = await page.evaluate(() => document.body.innerText);
    ok(`офлайн ${route}`, re.test(body), resp ? `HTTP ${resp.status()}` : "из кэша");
  } catch (e) {
    ok(`офлайн ${route}`, false, String(e).slice(0, 80));
  }
}

// Экран сравнения офлайн
await page.goto(BASE + "/result", { waitUntil: "domcontentloaded" });
await sleep(900);
const cmp = await page.evaluate(() => document.body.innerText);
ok("офлайн: экран сравнения отрисован", /В чём разница|Айырмашылық неде|What makes the difference/.test(cmp));
ok("офлайн: симулятор посчитал наивный путь", /Обычная адаптивная система|Әдеттегі бейімделетін|typical adaptive system/.test(cmp));

// Панель «след ИИ» офлайн
await page.goto(BASE + "/node/frac_operations", { waitUntil: "domcontentloaded" });
await sleep(1200);
const traceOpened = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /ИИ ізі|След ИИ|AI trace/.test(x.textContent ?? ""));
  if (!b) return null;
  b.click();
  return true;
});
await sleep(400);
const traceText = await page.evaluate(() => document.body.innerText);
ok("офлайн: панель «след ИИ» открывается", traceOpened === true);
ok("офлайн: панель показывает число фрагментов", /(фрагмент|үзінді|fragments)/i.test(traceText) && /\d/.test(traceText));
ok("офлайн: объяснение и маркер источника на месте", /Математика, 6 (класс|сынып)/.test(traceText));

// ---------- ПЕРЕЗАГРУЗКА ОФЛАЙН ----------
await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
await sleep(1200);
const afterReload = await page.evaluate(() => document.body.innerText);
ok("офлайн: страница пережила перезагрузку", /Түсіндірме|Объяснение|Explanation/.test(afterReload));

// Навигация после перезагрузки
await page.goto(BASE + "/teacher", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
await sleep(900);
const afterNav = await page.evaluate(() => document.body.innerText);
ok("офлайн: навигация после перезагрузки работает", /Мұғалім панелі|Панель учителя|Teacher panel/.test(afterNav));
ok("офлайн: тепловая карта отрисована", /48%|Жылу картасы|Тепловая карта|Heat map/.test(afterNav));

// ---------- 360px ----------
await page.setViewport({ width: 360, height: 780 });
for (const r of ["/", "/diagnose", "/teacher", "/result"]) {
  await page.goto(BASE + r, { waitUntil: "domcontentloaded" }).catch(() => {});
  await sleep(600);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`360px без горизонтального скролла: ${r}`, overflow <= 1, `overflow ${overflow}px`);
}

ok(`ноль console.error (${consoleErrors.length})`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();

const pass = results.filter((r) => r.pass).length;
console.log(`\n${"=".repeat(64)}`);
for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.n}${r.d ? "   — " + r.d : ""}`);
console.log(`${"=".repeat(64)}`);
console.log(`  ПРОЙДЕНО ${pass} из ${results.length}`);
process.exit(pass === results.length ? 0 : 1);
