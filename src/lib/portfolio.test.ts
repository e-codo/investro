import { describe, expect, it } from "vitest";
import { allocation, couponsByMonth, deductionsTotal, goalProgress, investedOwn, milestoneStates, profitK, profitPercent, streak, xirr, yearlyReturn, type Snap } from "./portfolio";
import { midDate } from "./dates";
import { percent, pointsDiff, rub } from "./format";

const snap = (month: string, periodEnd: string, valueK: number, contributionK: number, extra: Partial<Snap> = {}): Snap => ({
  month, periodEnd, valueK, cashK: 0, contributionK, deductionK: 0, withdrawalK: 0, flowDate: midDate(`${month}-01`, periodEnd), ...extra,
});
const AUG = snap("2026-08", "2026-08-31", 1810989, 1800000);
const SEP = snap("2026-09", "2026-09-30", 3623786, 1800000);
const OCT = snap("2026-10", "2026-10-05", 3646364, 0);

describe("вложено, прибыль, вычеты", () => {
  it("по реальным отчётам", () => {
    expect(investedOwn([AUG, SEP])).toBe(3600000);
    expect(profitK([AUG, SEP])).toBe(23786);
    expect(profitK([AUG, SEP, OCT])).toBe(46364);
    expect(profitPercent([AUG, SEP, OCT])).toBeCloseTo(1.288, 2);
  });
  it("вычет не входит во «вложено своих» и остаётся в прибыли", () => {
    const S = [AUG, { ...SEP, deductionK: 300000 }];
    expect(investedOwn(S)).toBe(3300000);
    expect(profitK(S)).toBe(323786);
    expect(deductionsTotal(S)).toBe(300000);
  });
  it("вывод уменьшает вложено своих", () => expect(investedOwn([AUG, { ...SEP, withdrawalK: 100000 }])).toBe(3500000));
  it("порядок снимков не важен", () => expect(profitK([OCT, AUG, SEP])).toBe(46364));
  it("процент прибыли без вложений — null", () => expect(profitPercent([snap("2026-10", "2026-10-05", 100, 0)])).toBeNull());
});

describe("годовая доходность", () => {
  it("эталон 1000 → 1100 за год = 10%", () => {
    expect(xirr([{ date: "2026-01-01", amountK: -1000 }, { date: "2027-01-01", amountK: 1100 }])).toBeCloseTo(10, 2);
  });
  it("вывод — приток", () => {
    const r = xirr([{ date: "2026-01-01", amountK: -1000 }, { date: "2026-07-02", amountK: 100 }, { date: "2027-01-01", amountK: 1000 }])!;
    const npv = (x: number) => -1000 + 100 / (1 + x) ** (182 / 365) + 1000 / (1 + x);
    expect(Math.abs(npv(r / 100))).toBeLessThan(1e-6);
  });
  it("до 90 дней «—»: на реальных данных", () => {
    expect(yearlyReturn([AUG, SEP])).toBeNull();
    expect(yearlyReturn([AUG, SEP, OCT])).toBeNull();
  });
  it("с 90 дней показывается", () => {
    const a = snap("2026-01", "2026-01-31", 1010000, 1000000);
    const b = snap("2026-06", "2026-06-30", 1100000, 0);
    expect(yearlyReturn([a, b])).not.toBeNull();
    expect(yearlyReturn([a, snap("2026-03", "2026-03-10", 1050000, 0)])).toBeNull();
  });
});

describe("цель, вехи, серия", () => {
  it("прогресс не больше 100%", () => {
    expect(goalProgress(150, 100)).toBe(100);
    expect(goalProgress(3646364, 300000000)).toBeCloseTo(1.215, 2);
  });
  it("вехи: пройденные с датой, ближайшая, будущие", () => {
    const m = milestoneStates([AUG, SEP], [10000000, 1500000, 2000000, 25000000]);
    expect(m.map((x) => x.amountK)).toEqual([1500000, 2000000, 10000000, 25000000]);
    expect(m.map((x) => x.state)).toEqual(["done", "done", "next", "future"]);
    expect(m[0].date).toBe("2026-08-31"); // 15 тыс. пройдены в августе (18 тыс.)
    expect(m[1].date).toBe("2026-09-30"); // 20 тыс. в сентябре
    expect(m[2].date).toBeNull();
  });
  it("серия от текущего или прошлого месяца", () => {
    expect(streak([AUG, SEP, OCT], "2026-10")).toBe(2);
    expect(streak([AUG, SEP, { ...OCT, contributionK: 5 }], "2026-10")).toBe(3);
    expect(streak([snap("2026-07", "2026-07-31", 1, 1), SEP], "2026-10")).toBe(1); // пропуск в августе рвёт серию
    expect(streak([snap("2026-07", "2026-07-31", 1, 1)], "2026-10")).toBe(0);
  });
  it("месяц только с вычетом не считается взносом", () => {
    expect(streak([{ ...AUG, deductionK: 1800000 }], "2026-08")).toBe(0);
  });
});

describe("аллокация и купоны", () => {
  const classes = [{ id: "b", name: "Облигации", weight: 60 }, { id: "e", name: "Акции", weight: 20 }, { id: "l", name: "Ликвидность", weight: 20 }];
  it("доли от суммы позиций, в сумме 100%", () => {
    const rows = allocation(classes, [{ classId: "b", valueK: 2173345 }, { classId: "e", valueK: 683925 }, { classId: "l", valueK: 740872 }]);
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(100, 9);
    expect(Math.floor(rows[0].share)).toBe(60);
    expect(rows[0].deviation).toBeCloseTo(rows[0].share - 60, 9);
  });
  it("без позиций доли нулевые", () => expect(allocation(classes, []).every((r) => r.share === 0)).toBe(true));
  it("купоны по месяцам", () => {
    expect(couponsByMonth([{ date: "2026-09-24", amountK: 19499 }, { date: "2026-09-30", amountK: 1 }]).get("2026-09")).toBe(19500);
  });
});

describe("показ чисел", () => {
  it("рубли вниз по модулю, расчёт не округляется", () => {
    expect(rub(3623786)).toBe("36 237 ₽");
    expect(rub(23786, { sign: true })).toBe("+237 ₽");
    expect(rub(-11214)).toBe("−112 ₽");
    expect(rub(99, { sign: true })).toBe("0 ₽");
    expect(rub(3623786, { exact: true })).toBe("36 237,86 ₽");
  });
  it("проценты и пункты без дробной части", () => {
    expect(percent(0.7)).toBe("0%");
    expect(percent(60.4)).toBe("60%");
    expect(percent(-0.4)).toBe("0%");
    expect(pointsDiff(0.4)).toBe("0 п.п.");
    expect(pointsDiff(-1.9)).toBe("−1 п.п.");
  });
});
