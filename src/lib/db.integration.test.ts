// Интеграционные тесты с настоящим Postgres. Запуск: DATABASE_URL_TEST=postgres://… npm test
// Без переменной пропускаются. База должна быть с применёнными миграциями (npm run db:migrate).
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import parsedSep from "./report/fixtures/vtb-2026-09.json";
import parsedAug from "./report/fixtures/vtb-2026-08.json";
import { parsePdfItems, type PdfItem } from "./report/pdf-parse";
import { defaultClassId } from "./report/names";
import type { ParsedReport } from "./report/types";
import type { SnapshotInput } from "./schemas";
import { midDate } from "./dates";

const url = process.env.DATABASE_URL_TEST;
describe.skipIf(!url)("база: снимки, настройки, изоляция пользователей", () => {
  let db: Awaited<ReturnType<typeof import("@/db").getDb>>;
  let tables: typeof import("@/db").tables;
  let saveSnapshot: typeof import("./snapshots").saveSnapshot;
  let deleteSnapshot: typeof import("./snapshots").deleteSnapshot;
  let deleteAllData: typeof import("./snapshots").deleteAllData;
  let saveSettings: typeof import("./settings-save").saveSettings;
  let loadAppData: typeof import("./queries").loadAppData;
  let createUser: typeof import("./users").createUserWithDefaults;
  let userA = "";
  let userB = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    const dbMod = await import("@/db");
    db = dbMod.getDb();
    tables = dbMod.tables;
    ({ saveSnapshot, deleteSnapshot, deleteAllData } = await import("./snapshots"));
    ({ saveSettings } = await import("./settings-save"));
    ({ loadAppData } = await import("./queries"));
    ({ createUserWithDefaults: createUser } = await import("./users"));
    const stamp = Date.now();
    userA = await createUser(db, `a${stamp}@test.ru`, "hash");
    userB = await createUser(db, `b${stamp}@test.ru`, "hash");
  });
  afterAll(async () => {
    if (!url) return;
    await db.delete(tables.users).where(eq(tables.users.id, userA));
    await db.delete(tables.users).where(eq(tables.users.id, userB));
  });

  const input = async (user: string, r: ParsedReport, over: Partial<SnapshotInput> = {}): Promise<SnapshotInput> => {
    const data = await loadAppData(db, user);
    return {
      source: r.source, parserVersion: r.parserVersion, periodStart: r.periodStart, periodEnd: r.periodEnd,
      valueK: r.valueK, cashK: r.cashK, reportDepositK: r.depositK, contributionK: r.depositK, deductionK: 0,
      withdrawalK: r.withdrawalK + r.bankPayoutK, feesK: r.feesK, taxesK: r.taxesK, flowDate: midDate(r.periodStart, r.periodEnd),
      foreign: r.foreign, sectionTotals: r.sectionTotals,
      positions: r.positions.map((p) => ({ ...p, classId: defaultClassId(p.name, p.type, data.classes) })),
      coupons: r.coupons.map((c) => ({ name: c.name, date: c.date, amountK: c.amountK })),
      ...over,
    };
  };
  const aug = parsePdfItems(parsedAug as PdfItem[][]);
  const sep = parsePdfItems(parsedSep as PdfItem[][]);

  it("новый пользователь получает настройки по умолчанию", async () => {
    const d = await loadAppData(db, userA);
    expect(d.classes.map((c) => [c.name, c.weight])).toEqual([["Облигации", 60], ["Акции", 20], ["Ликвидность", 20]]);
    expect(d.milestonesK).toEqual([10000000, 25000000, 50000000, 100000000, 200000000]);
    expect(d.settings.goalK).toBe(300000000);
    expect(d.settings.depositRate).toBe(14);
    expect(d.settings.inflation).toBe(6.5);
  });

  it("сохраняет август и сентябрь, классы подставлены по умолчанию", async () => {
    expect(await saveSnapshot(db, userA, await input(userA, aug))).toEqual({ ok: true });
    expect(await saveSnapshot(db, userA, await input(userA, sep))).toEqual({ ok: true });
    const d = await loadAppData(db, userA);
    expect(d.snapshots.map((s) => [s.month, s.valueK, s.contributionK])).toEqual([["2026-08", 1810989, 1800000], ["2026-09", 3623786, 1800000]]);
    expect(d.snapshots[1].positions).toHaveLength(4);
    const byName = Object.fromEntries(d.instruments.map((i) => [i.name, d.classes.find((c) => c.id === i.classId)?.name]));
    expect(byName).toEqual({ "ОФЗ 26245": "Облигации", "РЖД 1Р-44R": "Облигации", "ВИМ - Индекс Мосбиржи": "Акции", "Ликвидность": "Ликвидность" });
    expect(d.coupons).toEqual([{ name: "РЖД 1Р-44R", date: "2026-09-24", amountK: 19499 }]);
  });

  it("повторная загрузка того же месяца заменяет снимок: без второго взноса и дублей купонов", async () => {
    expect(await saveSnapshot(db, userA, await input(userA, sep))).toEqual({ ok: true });
    const d = await loadAppData(db, userA);
    expect(d.snapshots).toHaveLength(2);
    expect(d.snapshots[1].contributionK).toBe(1800000);
    expect(d.snapshots[1].positions).toHaveLength(4);
    expect(d.coupons).toHaveLength(1);
    expect(d.instruments).toHaveLength(4);
  });

  it("сервер отклоняет то, что не проходит проверки", async () => {
    const wide = await input(userA, sep, { periodStart: "2026-01-01" });
    expect(await saveSnapshot(db, userA, wide)).toMatchObject({ ok: false, error: expect.stringContaining("несколько месяцев") });
    const bad = await input(userA, sep, { valueK: sep.valueK + 124500 });
    expect(await saveSnapshot(db, userA, bad)).toMatchObject({ ok: false, error: expect.stringContaining("не сходятся") });
    const noClass = await input(userA, sep);
    noClass.positions[0].classId = null;
    expect(await saveSnapshot(db, userA, noClass)).toMatchObject({ ok: false, error: expect.stringContaining("Выберите класс") });
    expect(await saveSnapshot(db, userA, await input(userA, sep, { deductionK: 1800001 }))).toMatchObject({ ok: false });
    expect(await saveSnapshot(db, userA, await input(userA, sep, { flowDate: "2026-10-01" }))).toMatchObject({ ok: false, error: expect.stringContaining("Дата взноса") });
    expect(await saveSnapshot(db, userA, { nonsense: true })).toMatchObject({ ok: false });
    expect((await loadAppData(db, userA)).snapshots).toHaveLength(2);
  });

  it("чужой класс принять нельзя, данные пользователей изолированы", async () => {
    const dataB = await loadAppData(db, userB);
    const stolen = await input(userA, sep);
    stolen.positions[0].classId = dataB.classes[0].id;
    expect(await saveSnapshot(db, userA, stolen)).toMatchObject({ ok: false, error: expect.stringContaining("неизвестный класс") });
    expect(dataB.snapshots).toEqual([]);
    expect(dataB.coupons).toEqual([]);
    expect(await deleteSnapshot(db, userB, "2026-09")).toMatchObject({ ok: false });
    expect((await loadAppData(db, userA)).snapshots).toHaveLength(2);
  });

  it("удаление снимка не трогает купоны и соседние снимки", async () => {
    expect(await deleteSnapshot(db, userA, "2026-08")).toEqual({ ok: true });
    const d = await loadAppData(db, userA);
    expect(d.snapshots.map((s) => s.month)).toEqual(["2026-09"]);
    expect(d.coupons).toHaveLength(1);
  });

  it("настройки: перенос бумаг при удалении класса, сумма долей, блоки", async () => {
    const d = await loadAppData(db, userA);
    const [bonds, stocks, liq] = d.classes;
    const base = {
      title: "Заголовок", subtitle: "Подзаголовок", quote: "Цитата", goalK: 500000000, depositRate: 15, inflation: 7.5,
      milestonesK: [30000000, 10000000, 10000000], strategyEnabled: true, strategyName: null,
      classes: d.classes.map((c) => ({ id: c.id, name: c.name, weight: c.weight })), transfers: [], instrumentClasses: {}, blocks: { growth: false },
    };
    expect(await saveSettings(db, userA, { ...base, classes: [{ ...base.classes[0], weight: 50 }, base.classes[1], base.classes[2]] })).toMatchObject({ ok: false, error: expect.stringContaining("100") });
    expect(await saveSettings(db, userA, { ...base, classes: [base.classes[0], { ...base.classes[1], weight: 40 }] })).toMatchObject({ ok: false, error: expect.stringContaining("перенести") });
    const res = await saveSettings(db, userA, {
      ...base,
      classes: [{ ...base.classes[0], weight: 80 }, { ...base.classes[1], weight: 20 }],
      transfers: [{ from: liq.id, to: stocks.id }],
    });
    expect(res).toEqual({ ok: true });
    const after = await loadAppData(db, userA);
    expect(after.classes.map((c) => [c.name, c.weight])).toEqual([["Облигации", 80], ["Акции", 20]]);
    expect(after.instruments.find((i) => i.name === "Ликвидность")!.classId).toBe(stocks.id);
    expect(after.milestonesK).toEqual([10000000, 30000000]);
    expect(after.settings).toMatchObject({ title: "Заголовок", goalK: 500000000, depositRate: 15, inflation: 7.5, blocks: { growth: false } });
    expect(bonds.id).toBe(after.classes[0].id);
  });

  it("настройки: новый класс и смена класса бумаги", async () => {
    const d = await loadAppData(db, userA);
    const inst = d.instruments.find((i) => i.name === "РЖД 1Р-44R")!;
    const res = await saveSettings(db, userA, {
      title: "T", subtitle: "S", quote: "Q", goalK: 100000000, depositRate: 14, inflation: 6.5, milestonesK: [], strategyEnabled: true, strategyName: "Моя",
      classes: [...d.classes.map((c) => ({ id: c.id, name: c.name, weight: c.weight - 10 })), { id: "new:1", name: "Золото", weight: 20 }],
      transfers: [], instrumentClasses: { [inst.id]: "new:1" }, blocks: {},
    });
    expect(res).toEqual({ ok: true });
    const after = await loadAppData(db, userA);
    expect(after.classes.at(-1)!.name).toBe("Золото");
    expect(after.instruments.find((i) => i.id === inst.id)!.classId).toBe(after.classes.at(-1)!.id);
    expect(after.settings.strategyName).toBe("Моя");
    expect(after.milestonesK).toEqual([]);
  });

  it("ограничение перебора: 5 неудач закрывают вход, счётчик адреса не сбрасывается входом", async () => {
    const t = await import("./throttle");
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}`;
    const email = `thr${Date.now()}@test.ru`;
    expect(await t.loginLocked(ip, email)).toBe(false);
    for (let i = 0; i < t.LOGIN_MAX_FAILURES; i++) await t.recordLoginFailure(ip, email);
    expect(await t.loginLocked(ip, email)).toBe(true);
    expect(await t.loginLocked(ip, "other@test.ru")).toBe(true); // блокировка по адресу
    expect(await t.loginLocked("198.51.100.7", email)).toBe(true); // блокировка по почте
    await t.clearEmailFailures(email);
    expect(await t.loginLocked("198.51.100.7", email)).toBe(false);
    expect(await t.loginLocked(ip, email)).toBe(true); // счётчик адреса остался
  });
  it("ограничение регистраций: не больше 5 в час с адреса", async () => {
    const t = await import("./throttle");
    const ip = `203.0.113.${100 + Math.floor(Math.random() * 100)}`;
    for (let i = 0; i < t.REGISTER_MAX; i++) {
      expect(await t.registerLocked(ip)).toBe(false);
      await t.recordRegistration(ip);
    }
    expect(await t.registerLocked(ip)).toBe(true);
  });
  it("одна почта не регистрируется дважды (уникальный индекс)", async () => {
    await expect(createUser(db, (await db.select().from(tables.users).where(eq(tables.users.id, userA)))[0].email, "h")).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("«Удалить все данные» чистит снимки, купоны и бумаги, настройки остаются", async () => {
    expect(await deleteAllData(db, userA)).toEqual({ ok: true });
    const d = await loadAppData(db, userA);
    expect(d.snapshots).toEqual([]);
    expect(d.coupons).toEqual([]);
    expect(d.instruments).toEqual([]);
    expect(d.classes.length).toBeGreaterThan(0);
  });
});
