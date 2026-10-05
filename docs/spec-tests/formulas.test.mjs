// Эталонные расчёты из раздела 4 ТЗ и проверки раздела 2.1 на числах реальных отчётов ВТБ.
// Это образец будущих тестов приложения, а не сами тесты: приложения в репозитории пока нет.
// Запуск: node --test docs/spec-tests
import test from "node:test";
import assert from "node:assert/strict";

const net = (s) => s.dep - s.ded;
const own = (S) => S.reduce((a, s) => a + net(s) - s.wd, 0);
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;
function xirr(flows) {
  const t0 = Date.parse(flows[0].d);
  const npv = (r) => flows.reduce((a, f) => a + f.v / Math.pow(1 + r, (Date.parse(f.d) - t0) / 31536000000), 0);
  let lo = -0.95, hi = 20;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2 * 100;
}
const mid = (a, b) => new Date((Date.parse(a) + Date.parse(b)) / 2).toISOString().slice(0, 10);
function flowsOf(S) {
  const f = S.map((s) => ({ d: mid(s.ps, s.pe), v: -(net(s) - s.wd) }));
  f.push({ d: S.at(-1).pe, v: S.at(-1).value });
  return f;
}
const showXirr = (S) => (days(flowsOf(S)[0].d, S.at(-1).pe) >= 90 ? xirr(flowsOf(S)) : null);
const floorMoney = (k) => { const r = Math.floor(Math.abs(k) / 100); return (r === 0 ? "" : k < 0 ? "-" : "") + r; };
const sameMonth = (ps, pe) => ps.slice(0, 7) === pe.slice(0, 7) && ps <= pe;
const sumOk = (positions, cash, value) => Math.abs(positions + cash - value) <= 100;
function streak(paidMonths, cur) {
  const has = (y, m) => paidMonths.includes(`${y}-${String(m).padStart(2, "0")}`);
  let [y, m] = cur.split("-").map(Number); if (!has(y, m)) { m--; if (m === 0) { m = 12; y--; } }
  let n = 0; while (has(y, m)) { n++; m--; if (m === 0) { m = 12; y--; } } return n;
}

// Реальные месячные отчёты, копейки
const AUG = { ps: "2026-08-01", pe: "2026-08-31", value: 1810989, cash: 76, dep: 1800000, ded: 0, wd: 0 };
const SEP = { ps: "2026-09-01", pe: "2026-09-30", value: 3623786, cash: 25644, dep: 1800000, ded: 0, wd: 0 };
const OCT = { ps: "2026-10-01", pe: "2026-10-05", value: 3646364, cash: 25644, dep: 0, ded: 0, wd: 0 };

test("вложено своих и прибыль по реальным отчётам", () => {
  assert.equal(own([AUG, SEP]), 3600000);
  assert.equal(SEP.value - own([AUG, SEP]), 23786);          // +237,86 ₽
  assert.equal(OCT.value - own([AUG, SEP, OCT]), 46364);     // +463,64 ₽
});
test("вычет не входит во «вложено своих» и остаётся в прибыли", () => {
  const S = [{ ...AUG }, { ...SEP, ded: 300000 }];
  assert.equal(own(S), 3300000);
  assert.equal(SEP.value - own(S), 323786);
});
test("вывод уменьшает «вложено своих»", () => assert.equal(own([AUG, { ...SEP, wd: 100000 }]), 3500000));
test("XIRR: эталонный случай 1000 → 1100 за год даёт 10%", () => {
  const r = xirr([{ d: "2026-01-01", v: -1000 }, { d: "2027-01-01", v: 1100 }]);
  assert.ok(Math.abs(r - 10) < 0.01, String(r));
});
test("XIRR: вывод учитывается притоком", () => {
  const r = xirr([{ d: "2026-01-01", v: -1000 }, { d: "2026-07-02", v: 100 }, { d: "2027-01-01", v: 1000 }]);
  const npv = (x) => -1000 + 100 / (1 + x) ** (182 / 365) + 1000 / (1 + x);
  assert.ok(Math.abs(npv(r / 100)) < 1e-6);
});
test("доходность скрыта до 90 дней: на реальных данных «—»", () => {
  assert.equal(showXirr([AUG, SEP]), null);
  assert.equal(showXirr([AUG, SEP, OCT]), null);             // 16.08 → 05.10 = 50 дней
});
test("порог 90 дней: 89 дней скрыто, 90 показано", () => {
  const mk = (pe) => [{ ps: "2026-01-01", pe, value: 110000, dep: 100000, ded: 0, wd: 0 }];
  assert.equal(showXirr(mk("2026-02-01")), null);
  assert.notEqual(showXirr([{ ps: "2026-01-01", pe: "2026-06-30", value: 110000, dep: 100000, ded: 0, wd: 0 }]), null);
});
test("серия считается от текущего или прошлого месяца", () => {
  assert.equal(streak(["2026-08", "2026-09"], "2026-10"), 2);   // октябрь без взноса
  assert.equal(streak(["2026-08", "2026-09", "2026-10"], "2026-10"), 3);
  assert.equal(streak(["2026-07", "2026-09"], "2026-10"), 1);   // пропуск в августе рвёт серию
});
test("аллокация: доли классов в сумме 100% и от суммы позиций без денег", () => {
  const pos = { Облигации: 2173345, Акции: 683925, Ликвидность: 740872 };  // сентябрь, копейки
  const total = Object.values(pos).reduce((a, b) => a + b, 0);
  const shares = Object.values(pos).map((v) => v / total * 100);
  assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 100) < 1e-9);
  assert.equal(Math.floor(shares[0]), 60);
});
test("показ чисел: вниз по модулю, расчёт не округляется", () => {
  assert.equal(floorMoney(23786), "237");
  assert.equal(floorMoney(-11214), "-112");
  assert.equal(floorMoney(99), "0");
  assert.equal(floorMoney(-99), "0");
  assert.equal(Math.floor(0.7), 0);                            // 0,7% показывается как 0%
});
test("проверка периода: один календарный месяц", () => {
  assert.ok(sameMonth("2026-09-01", "2026-09-30"));
  assert.ok(sameMonth("2026-10-01", "2026-10-05"));
  assert.ok(!sameMonth("2026-01-01", "2026-10-05"));           // отчёт с начала года отклоняется
  assert.ok(!sameMonth("2026-08-15", "2026-09-10"));
});
test("проверка сумм ±1 ₽ на реальных отчётах и границы допуска", () => {
  assert.ok(sumOk(3598142, 25644, 3623786));                   // сентябрь
  assert.ok(sumOk(1810913, 76, 1810989));                      // август
  assert.ok(sumOk(100, 0, 0));                                 // ровно 1 ₽
  assert.ok(!sumOk(101, 0, 0));                                // 1,01 ₽ уже ошибка
  assert.ok(!sumOk(3473642, 25644, 3623786));                  // сценарий «ошибка суммы» из макета
});
test("взнос месяца равен пополнениям отчёта, повторная загрузка не меняет", () => {
  const load = (rep) => rep.dep;
  assert.equal(load(SEP), 1800000);
  assert.equal(load(SEP), load({ ...SEP }));
});
