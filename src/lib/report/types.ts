export type AssetType = "bond" | "fund" | "stock";

export type ParsedPosition = { name: string; type: AssetType; quantity: number; valueK: number };
export type ParsedCoupon = { name: string; date: string; amountK: number };

/** Разобранный отчёт. Деньги в копейках, даты ГГГГ-ММ-ДД. */
export type ParsedReport = {
  source: "pdf" | "table";
  parserVersion: string;
  periodStart: string;
  periodEnd: string;
  valueK: number;
  cashK: number;
  positions: ParsedPosition[];
  /** Строки «Итого» разделов отчёта; null, если раздела нет или итога нет. */
  sectionTotals: { bond: number | null; fund: number | null; stock: number | null };
  coupons: ParsedCoupon[];
  /** Пополнения за период, рубли. */
  depositK: number;
  withdrawalK: number;
  bankPayoutK: number;
  feesK: number;
  taxesK: number;
  /** В отчёте есть операции в валюте. */
  foreign: boolean;
  /** Предупреждения разбора (например, неизвестный раздел). */
  warnings: string[];
};

/** Формат файла не распознан: причина пишется простым языком и показывается пользователю. */
export class ReportFormatError extends Error {}

export const PDF_PARSER_VERSION = "pdf-2";
export const TABLE_PARSER_VERSION = "table-2";
