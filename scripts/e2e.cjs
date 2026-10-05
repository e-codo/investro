// Сквозная проверка в браузере: регистрация, загрузка реальных PDF и таблицы, настройки, выход.
// Нужен запущенный сервер (npm run build && npm start) и PDF-отчёты по путям из переменных REPORT_*.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const R = { aug: process.env.REPORT_AUG, sep: process.env.REPORT_SEP, ytd: process.env.REPORT_YTD, xlsx: process.env.REPORT_XLSX };

const log = [];
const norm = (t) => (t ?? "").replace(/\s+/g, " ");
/** Ждёт, пока условие станет истинным (после router.refresh данные обновляются не мгновенно). */
async function eventually(fn, ms = 6000) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return true; } catch {}
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 150));
  }
}
const ok = (name, cond, extra = "") => { log.push([cond ? "ОК " : "ОШИБКА", name, extra]); if (!cond) process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/fonts|Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()));

  await page.goto(BASE + "/");
  ok("без входа ведёт на /login", page.url().endsWith("/login"));

  // регистрация
  const email = `e2e${Date.now()}@test.ru`;
  await page.click("text=Создать аккаунт");
  await page.fill("#email", email);
  await page.fill("#password", "12345678");
  await page.click("button[type=submit]");
  await page.waitForURL(BASE + "/", { timeout: 15000 });
  ok("регистрация и вход", true);
  await page.waitForSelector("text=Загрузите первый отчёт");
  ok("пустое состояние: «Загрузите первый отчёт»", true);
  ok("заголовок и подзаголовок из старого проекта", (await page.textContent(".hero")).includes("Строю надёжно. Строю по плану. Без спешки."));

  async function upload(file) {
    await page.click(".fab");
    await page.setInputFiles("#report-file", file);
  }
  const reviewText = async () => (await page.textContent(".sheet")).replace(/\s+/g, " ");

  // август
  await upload(R.aug);
  await page.waitForSelector("text=Проверьте отчёт", { timeout: 20000 });
  let t = await reviewText();
  ok("август: режим «Отметить месяц»", t.includes("Отметить месяц"));
  ok("август: месяц и дата снимка", t.includes("август 2026") && t.includes("31.08.2026"));
  ok("август: три позиции, классы подставлены", (await page.$$(".pos")).length === 3 && (await page.$$eval(".pos select", (s) => s.map((x) => x.selectedOptions[0].textContent))).join() === "Облигации,Акции,Ликвидность");
  ok("август: взнос 18 000", (await page.inputValue("#rv-deposit")) === "18000,00");
  ok("август: предупреждение про ранний старт счёта не показано как ошибка", !(await page.$(".err")));
  await page.click("text=Сохранить");
  await page.waitForSelector(".sheet", { state: "detached", timeout: 10000 });
  await page.waitForSelector("text=18 109 ₽", { timeout: 10000 });
  ok("август сохранён: стоимость 18 109 ₽", true);

  // сентябрь
  await upload(R.sep);
  await page.waitForSelector("text=Проверьте отчёт", { timeout: 20000 });
  t = await reviewText();
  ok("сентябрь: режим «Отметить месяц», купон 24.09.2026", t.includes("Отметить месяц") && t.includes("24.09.2026"));
  ok("сентябрь: 4 позиции", (await page.$$(".pos")).length === 4);
  await page.click("text=Сохранить");
  await page.waitForSelector(".sheet", { state: "detached", timeout: 10000 });
  await page.waitForSelector("text=36 237 ₽", { timeout: 10000 });
  const kv = (await page.textContent(".kv")).replace(/\s+/g, " ");
  ok("сентябрь: вложено 36 000, прибыль +237", kv.includes("36 000 ₽") && kv.includes("+237 ₽"), kv);
  ok("доходность «—» до 90 дней", /Годовая доходность\s*—/.test(kv));
  const paid = await page.$$(".cell.paid");
  ok("календарь: закрашены август и сентябрь", paid.length === 2);
  ok("аллокация показана", !!(await page.$("text=Аллокация")));
  ok("купонный календарь: получено 194 ₽", await eventually(async () => norm(await page.textContent("#coupon-box .coupons")).includes("194 ₽")));
  ok("купонный календарь: три плитки, сентябрь с фактом", (await page.$$("#coupon-box .cpl > div")).length === 3 && (await page.textContent("#coupon-box")).includes("РЖД 1Р-44R"));

  // отчёт с начала года
  await upload(R.ytd);
  await page.waitForSelector("text=Проверьте отчёт", { timeout: 20000 });
  t = await reviewText();
  ok("отчёт с начала года отклоняется", t.includes("охватывает несколько месяцев") && (await page.isDisabled("text=Сохранить")));
  await page.click("text=Отмена");

  // таблица по шаблону: актуализация сентября
  await upload(R.xlsx);
  await page.waitForSelector("text=Проверьте отчёт", { timeout: 20000 });
  t = await reviewText();
  ok("таблица: режим «Актуализировать данные»", t.includes("Актуализировать данные"));
  ok("таблица: те же числа (36237,86)", (await page.inputValue("#rv-value")) === "36237,86");
  await page.click("text=Сохранить");
  await page.waitForSelector(".sheet", { state: "detached", timeout: 10000 });
  ok("после замены календарь без второго взноса", await eventually(async () => (await page.$$(".cell.paid")).length === 2 && norm(await page.textContent(".kv")).includes("36 000 ₽")));

  // карточка месяца
  await page.click(".cell.paid >> nth=1");
  ok("карточка месяца открывается", !!(await page.$(".mcard")));
  ok("в карточке кнопки «Заменить» и «Удалить»", !!(await page.$("text=Заменить отчёт")) && !!(await page.$("text=Удалить снимок")));

  // анимации стартуют по появлению блока на экране
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const pending = await page.$$eval("[data-reveal]:not(.in)", (e) => e.length);
  ok("блоки ниже экрана ждут появления (анимации на паузе)", pending > 0, `ждут ${pending}`);
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= height; y += 300) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
  ok("после прокрутки все блоки ожили", await eventually(async () => (await page.$$eval("[data-reveal]:not(.in)", (e) => e.length)) === 0));
  await page.evaluate(() => window.scrollTo(0, 0));

  // экран ожидания: быстрый переход его не показывает, медленный показывает и держит не меньше 0,5 с
  let overlayFast = false;
  const watcher = setInterval(async () => { if (await page.$(".wait.on").catch(() => null)) overlayFast = true; }, 30);
  await page.click("a[href='/settings']");
  await page.waitForURL(BASE + "/settings");
  await page.waitForTimeout(500);
  clearInterval(watcher);
  ok("быстрый переход без экрана ожидания", !overlayFast);
  await page.click("text=Отмена");
  await page.waitForURL(BASE + "/");
  await page.route("**/settings*", async (route) => { await new Promise((r) => setTimeout(r, 1400)); await route.continue(); });
  const slowClick = page.click("a[href='/settings']");
  const shown = await page.waitForSelector(".wait.on", { timeout: 3000 }).then(() => true).catch(() => false);
  ok("медленный переход показывает экран ожидания", shown);
  if (shown) {
    const t1 = Date.now();
    const box = await page.$eval(".wait.on", (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(e).backgroundColor, !!e.querySelector("svg animate")]; });
    ok("экран ожидания на весь экран, цвет #222222, стрелка анимируется", box[0] === 1100 && box[1] === 900 && box[2] === "rgb(34, 34, 34)" && box[3], JSON.stringify(box));
    await slowClick;
    await page.waitForURL(BASE + "/settings");
    ok("экран ожидания гаснет после перехода", await eventually(async () => !(await page.$(".wait.on")), 4000), `${Date.now() - t1} мс`);
  }
  await page.unroute("**/settings*");
  await page.goto(BASE + "/");

  // настройки
  const t0 = Date.now();
  await page.click("a[href='/settings']");
  await page.waitForURL(BASE + "/settings");
  ok("переход в настройки", true, `${Date.now() - t0} мс`);
  ok("в настройках блоков 9", (await page.$$(".tgl input")).length >= 9);
  await page.uncheck("text=6. Рост портфеля");
  await page.click("text=Сохранить");
  await page.waitForURL(BASE + "/", { timeout: 15000 });
  await page.waitForTimeout(800);
  ok("блок «Рост портфеля» скрыт без пустого места", !(await page.$("text=Рост портфеля")));
  await page.click("a[href='/settings']");
  await page.waitForURL(BASE + "/settings");
  await page.check("text=6. Рост портфеля");
  // смена долей: 50/30/20
  const weights = await page.$$(".rowx input[aria-label='Доля, %']");
  await weights[0].fill("50"); await weights[1].fill("30");
  await page.click("text=Сохранить");
  await page.waitForURL(BASE + "/", { timeout: 15000 });
  await page.waitForSelector("text=Рост портфеля");
  ok("блок вернулся", true);
  const alloc = (await page.textContent(".arow")).replace(/\s+/g, " ");
  ok("доли стратегии пересчитаны сразу", alloc.includes("50%"), alloc);

  // шаблон
  const tpl = await ctx.request.get(BASE + "/template-report.xlsx");
  ok("шаблон скачивается после входа", tpl.status() === 200 && (await tpl.body()).length > 4000);

  // ширина и прокрутка
  for (const w of [320, 768, 1100, 1920]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, body: Math.round(document.body.getBoundingClientRect().width) }));
    ok(`ширина ${w}: без прокрутки вбок, страница не шире 1024`, m.sw <= m.cw && m.body <= 1024, JSON.stringify(m));
  }
  await page.setViewportSize({ width: 1100, height: 900 });

  // выход
  await page.click("button[aria-label='Выйти']");
  await page.waitForURL(BASE + "/login", { timeout: 15000 });
  ok("выход ведёт на /login", true);
  await page.goto(BASE + "/settings");
  ok("после выхода настройки закрыты", page.url().endsWith("/login"));

  // повторный вход
  await page.fill("#email", email);
  await page.fill("#password", "12345678");
  await page.click("button[type=submit]");
  await page.waitForURL(BASE + "/", { timeout: 15000 });
  ok("повторный вход: данные на месте", await eventually(async () => norm(await page.textContent(".big")).includes("36 237")));

  ok("ошибок консоли нет", errors.length === 0, errors.join(" | "));
  await browser.close();
  for (const [s, n, e] of log) console.log(s, n, e);
  console.log(process.exitCode ? "ЕСТЬ ОШИБКИ" : "ВСЕ ПРОВЕРКИ ПРОШЛИ");
})().catch((e) => { console.error("СБОЙ", e); process.exit(1); });
