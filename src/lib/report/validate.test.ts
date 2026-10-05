import { describe, expect, it } from "vitest";
import { checkDraft, type DraftToCheck } from "./validate";

const SEP: DraftToCheck = {
  periodStart: "2026-09-01", periodEnd: "2026-09-30", valueK: 3623786, cashK: 25644,
  positions: [
    { name: "ОФЗ 26245", type: "bond", valueK: 520452 }, { name: "РЖД 1Р-44R", type: "bond", valueK: 1652893 },
    { name: "ВИМ - Индекс Мосбиржи", type: "fund", valueK: 683925 }, { name: "Ликвидность", type: "fund", valueK: 740872 },
  ],
  sectionTotals: { bond: 2173345, fund: 1424797, stock: null }, foreign: false, contributionK: 1800000, deductionK: 0, withdrawalK: 0,
};
const AUG = { month: "2026-08", periodEnd: "2026-08-31" };

describe("проверки перед сохранением", () => {
  it("сентябрь проходит без ошибок и предупреждений", () => {
    const r = checkDraft(SEP, [AUG]);
    expect(r).toEqual({ month: "2026-09", errors: [], warnings: [] });
  });
  it("отчёт с начала года отклоняется", () => {
    const r = checkDraft({ ...SEP, periodStart: "2026-01-01", periodEnd: "2026-10-05" }, []);
    expect(r.month).toBeNull();
    expect(r.errors[0]).toMatch(/охватывает несколько месяцев \(01\.01\.2026 – 05\.10\.2026\)/);
  });
  it("позиции + деньги ≠ стоимость", () => {
    const bad = { ...SEP, positions: SEP.positions.map((p) => (p.name === "Ликвидность" ? { ...p, valueK: 616372 } : p)), sectionTotals: { ...SEP.sectionTotals, fund: 1300297 } };
    expect(checkDraft(bad, [AUG]).errors.join(" ")).toMatch(/разница −1 245,00 ₽/);
  });
  it("допуск ±1 ₽ на границе", () => {
    expect(checkDraft({ ...SEP, valueK: SEP.valueK + 100 }, [AUG]).errors).toEqual([]);
    expect(checkDraft({ ...SEP, valueK: SEP.valueK + 101 }, [AUG]).errors.length).toBeGreaterThan(0);
  });
  it("итог раздела не сходится", () => {
    expect(checkDraft({ ...SEP, sectionTotals: { ...SEP.sectionTotals, bond: 2170000 } }, [AUG]).errors.join(" ")).toMatch(/Итог раздела «Облигации»/);
  });
  it("нет строки «Итого» у раздела с позициями", () => {
    expect(checkDraft({ ...SEP, sectionTotals: { bond: null, fund: 1424797, stock: null } }, [AUG]).errors.join(" ")).toMatch(/не найдена строка «Итого»/);
  });
  it("вычет больше взноса", () => {
    expect(checkDraft({ ...SEP, deductionK: 1800001 }, [AUG]).errors).toEqual(["Налоговый вычет больше взноса месяца."]);
  });
  it("валюта", () => expect(checkDraft({ ...SEP, foreign: true }, [AUG]).errors[0]).toMatch(/валюте/));
  it("предупреждения: не с 1-го, пропуск месяцев, более ранние данные", () => {
    expect(checkDraft({ ...SEP, periodStart: "2026-09-05" }, [AUG]).warnings[0]).toMatch(/не с 1-го числа/);
    expect(checkDraft(SEP, [{ month: "2026-06", periodEnd: "2026-06-30" }]).warnings[0]).toBe("За 2 мес. между снимками отчётов нет, взносы за них не учтены.");
    expect(checkDraft(SEP, [AUG, { month: "2026-09", periodEnd: "2026-10-02" }]).warnings[0]).toMatch(/более ранними на 30\.09\.2026/);
  });
  it("первый снимок с подозрением на более ранний старт счёта", () => {
    expect(checkDraft(SEP, []).warnings.join(" ")).toMatch(/счёт открыт раньше/);
    expect(checkDraft({ ...SEP, contributionK: 3600000 }, []).warnings).toEqual([]);
  });
  it("замена того же месяца не считается пропуском", () => {
    expect(checkDraft(SEP, [AUG, { month: "2026-09", periodEnd: "2026-09-30" }]).warnings).toEqual([]);
  });
});
