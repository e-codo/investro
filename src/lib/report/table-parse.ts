import { ReportFormatError, TABLE_PARSER_VERSION, type AssetType, type ParsedCoupon, type ParsedPosition, type ParsedReport } from "./types";
import { cleanName } from "./names";

export type Cell = string | number | boolean | Date | null | undefined;
export type TableSheets = { report: Cell[][]; positions: Cell[][]; coupons: Cell[][] };

export const TEMPLATE_VERSION = 2;
export const SHEET_NAMES = { report: "Отчёт", positions: "Позиции", coupons: "Купоны" } as const;

const FIELDS = {
  version: "Версия шаблона",
  start: "Период с",
  end: "Период по",
  value: "Стоимость портфеля, ₽",
  cash: "Деньги, ₽",
  deposits: "Пополнения за период, ₽",
  withdrawals: "Выводы за период, ₽",
  bankPayout: "Выплаты на счёт в банке, ₽",
  fees: "Комиссии, ₽",
  taxes: "Налоги, ₽",
  bonds: "Итого по облигациям, ₽",
  funds: "Итого по фондам, ₽",
} as const;

const SECTION_TYPE: Record<string, AssetType> = { Облигации: "bond", Фонды: "fund", Акции: "stock" };

const fail = (sheet: string, row: number | null, msg: string): never => {
  throw new ReportFormatError(`Лист «${sheet}»${row ? `, строка ${row}` : ""}: ${msg}`);
};
const blank = (c: Cell) => c == null || (typeof c === "string" && c.trim() === "");

function toDate(c: Cell, sheet: string, row: number, what: string): string {
  if (c instanceof Date && !Number.isNaN(c.getTime())) return c.toISOString().slice(0, 10);
  if (typeof c === "string") {
    const m = c.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) {
      const iso = `${m[3]}-${m[2]}-${m[1]}`;
      if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso) return iso;
    }
  }
  return fail(sheet, row, `«${what}» должна быть датой в формате ДД.ММ.ГГГГ.`);
}

function toKopecks(c: Cell, sheet: string, row: number, what: string, { positive = false }: { positive?: boolean } = {}): number {
  if (typeof c !== "number" || !Number.isFinite(c)) return fail(sheet, row, `«${what}» должна быть числом (не текстом).`);
  if (c < 0 || (positive && c === 0)) return fail(sheet, row, `«${what}» должна быть ${positive ? "больше нуля" : "не меньше нуля, без знака минус"}.`);
  return Math.round(c * 100);
}

/** Разбор таблицы по шаблону (версия 2). Ничего не угадывает: любая ошибка формата отклоняет файл с указанием листа и строки. */
export function parseTableSheets(sheets: TableSheets): ParsedReport {
  const S = SHEET_NAMES;
  // --- лист «Отчёт»
  const rows = sheets.report;
  if (!rows.length || String(rows[0]?.[0] ?? "").trim() !== "Поле" || String(rows[0]?.[1] ?? "").trim() !== "Значение") {
    fail(S.report, 1, "заголовки колонок должны быть «Поле» и «Значение».");
  }
  const byField = new Map<string, { value: Cell; row: number }>();
  rows.forEach((r, i) => {
    const name = typeof r[0] === "string" ? r[0].trim() : "";
    if (i > 0 && name) byField.set(name, { value: r[1], row: i + 1 });
  });
  const get = (name: string) => {
    const f = byField.get(name);
    if (!f || blank(f.value)) return fail(S.report, f?.row ?? null, `нет значения в поле «${name}».`);
    return f;
  };
  const version = get(FIELDS.version);
  if (version.value !== TEMPLATE_VERSION) fail(S.report, version.row, `версия шаблона ${String(version.value)} не поддерживается. Скачайте актуальный шаблон (версия ${TEMPLATE_VERSION}).`);
  const k = (name: string, opts?: { positive?: boolean }) => {
    const f = get(name);
    return toKopecks(f.value, S.report, f.row, name, opts);
  };
  const d = (name: string) => {
    const f = get(name);
    return toDate(f.value, S.report, f.row, name);
  };
  const periodStart = d(FIELDS.start);
  const periodEnd = d(FIELDS.end);
  const valueK = k(FIELDS.value);
  const cashK = k(FIELDS.cash);
  const depositK = k(FIELDS.deposits);
  const withdrawalK = k(FIELDS.withdrawals);
  const bankPayoutK = k(FIELDS.bankPayout);
  const feesK = k(FIELDS.fees);
  const taxesK = k(FIELDS.taxes);
  const bondsTotal = k(FIELDS.bonds);
  const fundsTotal = k(FIELDS.funds);

  // --- лист «Позиции»
  const pos = sheets.positions;
  const posHead = ["Название", "Раздел", "Количество", "Стоимость, ₽"];
  posHead.forEach((h, i) => {
    if (String(pos[0]?.[i] ?? "").trim() !== h) fail(S.positions, 1, `заголовок колонки ${"ABCD"[i]} должен быть «${h}».`);
  });
  const positions: ParsedPosition[] = [];
  const seen = new Set<string>();
  pos.slice(1).forEach((r, idx) => {
    const row = idx + 2;
    if (r.slice(0, 4).every(blank)) return;
    const name = typeof r[0] === "string" ? cleanName(r[0]) : "";
    if (!name) fail(S.positions, row, "не заполнено название.");
    const section = typeof r[1] === "string" ? r[1].trim() : "";
    const type = SECTION_TYPE[section];
    if (!type) fail(S.positions, row, `раздел «${section}» неизвестен. Допустимо: Облигации, Фонды, Акции.`);
    const q = r[2];
    if (typeof q !== "number" || !Number.isInteger(q) || q <= 0) fail(S.positions, row, "количество должно быть целым числом больше нуля.");
    const key = `${type}:${name.toLowerCase()}`;
    if (seen.has(key)) fail(S.positions, row, `бумага «${name}» повторяется.`);
    seen.add(key);
    positions.push({ name, type, quantity: q as number, valueK: toKopecks(r[3], S.positions, row, "Стоимость, ₽") });
  });

  // --- лист «Купоны»
  const cp = sheets.coupons;
  const cpHead = ["Название", "Дата выплаты", "Сумма, ₽"];
  cpHead.forEach((h, i) => {
    if (String(cp[0]?.[i] ?? "").trim() !== h) fail(S.coupons, 1, `заголовок колонки ${"ABC"[i]} должен быть «${h}».`);
  });
  const coupons: ParsedCoupon[] = [];
  cp.slice(1).forEach((r, idx) => {
    const row = idx + 2;
    if (r.slice(0, 3).every(blank)) return;
    const name = typeof r[0] === "string" ? cleanName(r[0]) : "";
    if (!name) fail(S.coupons, row, "не заполнено название.");
    coupons.push({ name, date: toDate(r[1], S.coupons, row, "Дата выплаты"), amountK: toKopecks(r[2], S.coupons, row, "Сумма, ₽", { positive: true }) });
  });

  return {
    source: "table",
    parserVersion: TABLE_PARSER_VERSION,
    periodStart,
    periodEnd,
    valueK,
    cashK,
    positions,
    sectionTotals: { bond: bondsTotal, fund: fundsTotal, stock: null },
    coupons,
    depositK,
    withdrawalK,
    bankPayoutK,
    feesK,
    taxesK,
    foreign: false,
    warnings: [],
  };
}
