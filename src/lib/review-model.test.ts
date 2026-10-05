import { describe, expect, it } from "vitest";
import sep from "./report/fixtures/vtb-2026-09.json";
import ytd from "./report/fixtures/vtb-ytd-2026-10-05.json";
import { parsePdfItems, type PdfItem } from "./report/pdf-parse";
import { draftFromReport, emptyDraft, evaluateDraft } from "./review-model";

const classes = [{ id: "b", name: "Облигации" }, { id: "e", name: "Акции" }, { id: "l", name: "Ликвидность" }];
const mk = (f: unknown) => draftFromReport(parsePdfItems(f as PdfItem[][]), classes, () => null);
const AUG = { month: "2026-08", periodEnd: "2026-08-31" };

describe("экран проверки: черновик → данные для сервера", () => {
  it("сентябрь: классы по умолчанию, взнос равен пополнениям, ошибок нет", () => {
    const d = mk(sep);
    expect(d.positions.map((p) => p.classId)).toEqual(["b", "b", "e", "l"]);
    const r = evaluateDraft(d, [AUG]);
    expect(r.errors).toEqual([]);
    expect(r.month).toBe("2026-09");
    expect(r.input).toMatchObject({ valueK: 3623786, cashK: 25644, contributionK: 1800000, reportDepositK: 1800000, deductionK: 0, withdrawalK: 0, flowDate: "2026-09-15" });
    expect(r.input!.positions).toHaveLength(4);
  });
  it("взнос вручную переопределяет, вычет не больше взноса", () => {
    const d = { ...mk(sep), contributionOverride: "15 000,50", deduction: "3 000" };
    const r = evaluateDraft(d, [AUG]);
    expect(r.input).toMatchObject({ contributionK: 1500050, deductionK: 300000 });
    expect(evaluateDraft({ ...d, deduction: "16 000" }, [AUG]).errors).toContain("Налоговый вычет больше взноса месяца.");
  });
  it("отчёт с начала года: ошибка периода", () => {
    const r = evaluateDraft(mk(ytd), []);
    expect(r.month).toBeNull();
    expect(r.errors[0]).toMatch(/несколько месяцев/);
  });
  it("неверное число и бумага без класса блокируют сохранение", () => {
    const d = { ...mk(sep), value: "abc" };
    d.positions[0].classId = null;
    const r = evaluateDraft(d, [AUG]);
    expect(r.input).toBeNull();
    expect(r.errors).toEqual(expect.arrayContaining(["Поле «Стоимость»: введите сумму числом.", "Выберите класс для бумаги «ОФЗ 26245»."]));
  });
  it("известный класс бумаги запоминается", () => {
    const d = draftFromReport(parsePdfItems(sep as PdfItem[][]), classes, (name) => (name === "Ликвидность" ? "e" : null));
    expect(d.positions.find((p) => p.name === "Ликвидность")!.classId).toBe("e");
  });
  it("ручной ввод: период и позиции вводятся самим, итоги разделов считаются по позициям", () => {
    const d = emptyDraft("2026-10-05");
    d.value = "100,00";
    d.cash = "0";
    d.positions = [{ name: "ОФЗ", type: "bond", quantity: "1", value: "100", classId: "b" }];
    const r = evaluateDraft(d, []);
    expect(r.errors).toEqual([]);
    expect(r.input!.sectionTotals.bond).toBe(10000);
  });
  it("дата взноса вне периода — ошибка", () => {
    const d = { ...mk(sep), flowDate: "2026-10-02" };
    expect(evaluateDraft(d, [AUG]).errors).toContain("Дата взноса должна лежать в периоде отчёта.");
  });
});
