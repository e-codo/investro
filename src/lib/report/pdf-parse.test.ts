import { describe, expect, it } from "vitest";
import aug from "./fixtures/vtb-2026-08.json";
import sep from "./fixtures/vtb-2026-09.json";
import ytd from "./fixtures/vtb-ytd-2026-10-05.json";
import ytd04 from "./fixtures/vtb-ytd-2026-10-04.json";
import { parsePdfItems, type PdfItem } from "./pdf-parse";
import { ReportFormatError } from "./types";

const pages = (f: unknown) => f as PdfItem[][];

describe("разбор PDF ВТБ: август 2026", () => {
  const r = parsePdfItems(pages(aug));
  it("шапка, деньги, пополнения", () => {
    expect(r.periodStart).toBe("2026-08-01");
    expect(r.periodEnd).toBe("2026-08-31");
    expect(r.valueK).toBe(1810989);
    expect(r.cashK).toBe(76);
    expect(r.depositK).toBe(1800000);
    expect(r.withdrawalK).toBe(0);
    expect(r.bankPayoutK).toBe(0);
    expect(r.feesK + r.taxesK).toBe(795);
    expect(r.foreign).toBe(false);
  });
  it("три позиции, название из двух строк склеено", () => {
    expect(r.positions).toEqual([
      { name: "ОФЗ 26245", type: "bond", quantity: 6, valueK: 531666 },
      { name: "ВИМ - Индекс Мосбиржи", type: "fund", quantity: 46, valueK: 546710 },
      { name: "Ликвидность", type: "fund", quantity: 3532, valueK: 732537 },
    ]);
  });
  it("итоги разделов, купонов нет (раздела выплат в отчёте нет)", () => {
    expect(r.sectionTotals).toEqual({ bond: 531666, fund: 1279247, stock: null });
    expect(r.coupons).toEqual([]);
  });
});

describe("разбор PDF ВТБ: сентябрь 2026", () => {
  const r = parsePdfItems(pages(sep));
  it("шапка и суммы", () => {
    expect(r.periodStart).toBe("2026-09-01");
    expect(r.periodEnd).toBe("2026-09-30");
    expect(r.valueK).toBe(3623786);
    expect(r.cashK).toBe(25644);
    expect(r.depositK).toBe(1800000);
    expect(r.feesK).toBe(2630);
    expect(r.taxesK).toBe(0);
  });
  it("четыре позиции", () => {
    expect(r.positions.map((p) => [p.name, p.quantity, p.valueK])).toEqual([
      ["ОФЗ 26245", 6, 520452],
      ["РЖД 1Р-44R", 17, 1652893],
      ["ВИМ - Индекс Мосбиржи", 55, 683925],
      ["Ликвидность", 3532, 740872],
    ]);
    expect(r.sectionTotals).toEqual({ bond: 2173345, fund: 1424797, stock: null });
  });
  it("купон", () => {
    expect(r.coupons).toEqual([{ name: "РЖД 1Р-44R", date: "2026-09-24", amountK: 19499 }]);
  });
});

describe("отчёты с начала года разбираются, период отдаётся для проверки", () => {
  it("05.10.2026", () => {
    const r = parsePdfItems(pages(ytd));
    expect(r.periodStart).toBe("2026-01-01");
    expect(r.periodEnd).toBe("2026-10-05");
    expect(r.valueK).toBe(3646364);
    expect(r.depositK).toBe(3600000);
    expect(r.feesK).toBe(3425);
  });
  it("04.10.2026: числа из первого образца", () => {
    const r = parsePdfItems(pages(ytd04));
    expect(r.valueK).toBe(3636873);
    expect(r.cashK).toBe(25644);
    expect(r.positions.map((p) => p.quantity)).toEqual([6, 17, 55, 3532]);
    expect(r.coupons[0]).toEqual({ name: "РЖД 1Р-44R", date: "2026-09-24", amountK: 19499 });
    expect(r.depositK).toBe(3600000);
    expect(r.feesK + r.taxesK).toBe(3425);
  });
});

describe("устойчивость к порядку и отсутствию разделов", () => {
  it("порядок фрагментов в потоке не важен", () => {
    const shuffled = pages(sep).map((p) => [...p].sort(() => Math.random() - 0.5));
    expect(parsePdfItems(shuffled).valueK).toBe(3623786);
    expect(parsePdfItems(shuffled).positions).toHaveLength(4);
  });
  it("чужой документ отклоняется простым текстом", () => {
    expect(() => parsePdfItems([[{ str: "Договор", x: 32, y: 800, w: 50 }]])).toThrow(/не отчёт ВТБ/);
  });
  it("пустой PDF не падает с непонятной ошибкой", () => {
    expect(() => parsePdfItems([[]])).toThrow(ReportFormatError);
  });
  it("в фикстурах нет номера счёта", () => {
    expect(JSON.stringify([aug, sep, ytd, ytd04])).not.toMatch(/14PD/);
  });
  it("неизвестный раздел выплат даёт предупреждение", () => {
    const p = JSON.parse(JSON.stringify(sep)) as PdfItem[][];
    p[2].push({ str: "Дивиденды", x: 32, y: 705, w: 60 });
    expect(parsePdfItems(p).warnings).toEqual(["Раздел «Дивиденды» не поддерживается: суммы из него не учтены."]);
  });
});
