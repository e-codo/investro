import { describe, expect, it } from "vitest";
import readXlsx, { readSheetNames } from "read-excel-file/node";
import { parsePdfItems, type PdfItem } from "./pdf-parse";
import sep from "./fixtures/vtb-2026-09.json";
import { parseTableSheets, type Cell, type TableSheets } from "./table-parse";
import { ReportFormatError } from "./types";

const EXAMPLE = "docs/template-report-example.xlsx";
const BLANK = "docs/template-report.xlsx";
async function sheets(path: string): Promise<TableSheets> {
  const read = (sheet: string) => readXlsx(path, { sheet }) as Promise<Cell[][]>;
  return { report: await read("Отчёт"), positions: await read("Позиции"), coupons: await read("Купоны") };
}

describe("таблица по шаблону", () => {
  it("образец даёт те же числа, что сентябрьский PDF", async () => {
    const t = parseTableSheets(await sheets(EXAMPLE));
    const p = parsePdfItems(sep as PdfItem[][]);
    expect({ ...t, source: "", parserVersion: "" }).toEqual({ ...p, source: "", parserVersion: "", warnings: [], sectionTotals: { bond: 2173345, fund: 1424797, stock: null }, bankPayoutK: 0 });
  });
  it("листы шаблона на месте", async () => {
    expect(await readSheetNames(BLANK)).toEqual(["Инструкция", "Отчёт", "Позиции", "Купоны"]);
  });
  it("пустой шаблон отклоняется с указанием места", async () => {
    await expect(Promise.resolve().then(async () => parseTableSheets(await sheets(BLANK)))).rejects.toThrow(/Лист «Отчёт».*нет значения в поле «Период с»/);
  });
  it("текст вместо числа", async () => {
    const s = await sheets(EXAMPLE);
    s.report[4][1] = "36 237,86";
    expect(() => parseTableSheets(s)).toThrow(/Лист «Отчёт», строка 5.*числом/);
  });
  it("неизвестная версия шаблона", async () => {
    const s = await sheets(EXAMPLE);
    s.report[1][1] = 1;
    expect(() => parseTableSheets(s)).toThrow(/версия шаблона 1 не поддерживается/);
  });
  it("неизвестный раздел и количество", async () => {
    const s = await sheets(EXAMPLE);
    s.positions[1][1] = "Валюта";
    expect(() => parseTableSheets(s)).toThrow(/Лист «Позиции», строка 2.*«Валюта» неизвестен/);
    const s2 = await sheets(EXAMPLE);
    s2.positions[2][2] = 1.5;
    expect(() => parseTableSheets(s2)).toThrow(/Лист «Позиции», строка 3.*целым числом/);
  });
  it("дата текстом ДД.ММ.ГГГГ принимается, чужой формат нет", async () => {
    const s = await sheets(EXAMPLE);
    s.report[2][1] = "01.09.2026";
    expect(parseTableSheets(s).periodStart).toBe("2026-09-01");
    s.report[2][1] = "2026/09/01";
    expect(() => parseTableSheets(s)).toThrow(ReportFormatError);
  });
  it("повтор бумаги и отрицательная сумма", async () => {
    const s = await sheets(EXAMPLE);
    s.positions.push(["ОФЗ 26245", "Облигации", 1, 10]);
    expect(() => parseTableSheets(s)).toThrow(/повторяется/);
    const s2 = await sheets(EXAMPLE);
    s2.report[8][1] = -26.3;
    expect(() => parseTableSheets(s2)).toThrow(/без знака минус/);
  });
});
