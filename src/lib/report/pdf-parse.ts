import { isDash, isMoneyCell, parseMoneyCell } from "../money";
import { cleanName } from "./names";
import { PDF_PARSER_VERSION, ReportFormatError, type AssetType, type ParsedCoupon, type ParsedPosition, type ParsedReport } from "./types";

/** Фрагмент текста PDF с координатами (как отдаёт pdfjs). */
export type PdfItem = { str: string; x: number; y: number; w: number };

type Row = { page: number; cells: PdfItem[] };

const ROW_TOLERANCE = 3;
const NAME_COLUMN_MAX_X = 100;
const HEADINGS = new Set(["Состав портфеля", "Деньги", "Доход по активам", "Облигации", "Фонды", "Акции", "Полученные выплаты", "Купоны", "Пополнения и выводы", "Комиссии и налоги"]);
const DATE_CELL = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const SHARE_CELL = /^\d+,\d{2}%$/;
const QTY_CELL = /^(\d[\d\s  ]*)\s*шт\.$/;

/** Строки страницы: фрагменты с близкой высотой считаются одной строкой, внутри строки порядок слева направо. Порядок текста в самом PDF не используется. */
function buildRows(pages: PdfItem[][]): Row[] {
  const rows: Row[] = [];
  pages.forEach((items, page) => {
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    let cur: { y: number; row: Row } | null = null;
    for (const it of sorted) {
      if (cur && Math.abs(cur.y - it.y) <= ROW_TOLERANCE) cur.row.cells.push(it);
      else {
        cur = { y: it.y, row: { page, cells: [it] } };
        rows.push(cur.row);
      }
    }
  });
  rows.forEach((r) => r.cells.sort((a, b) => a.x - b.x));
  return rows;
}

const text = (row: Row) => row.cells.map((c) => c.str.trim()).join(" ");
const first = (row: Row) => row.cells[0];

function headingOf(row: Row): string | null {
  if (row.cells.length !== 1) return null;
  const c = row.cells[0];
  return c.x < 40 && HEADINGS.has(c.str.trim()) ? c.str.trim() : null;
}

const toIso = (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}`;
const money = (c: PdfItem) => parseMoneyCell(c.str);
const moneyOrDash = (c: PdfItem) => (isDash(c.str) ? 0 : money(c));

type Section = "none" | "cash" | "bond" | "fund" | "stock" | "payouts" | "coupons" | "deposits" | "fees" | "done";
const ASSET_TYPE: Record<string, AssetType> = { bond: "bond", fund: "fund", stock: "stock" };

/** Разбор текстовых фрагментов PDF «Аналитика портфеля» ВТБ по координатам. Бросает ReportFormatError с причиной простым языком. */
export function parsePdfItems(pages: PdfItem[][]): ParsedReport {
  const rows = buildRows(pages);
  const head = rows.filter((r) => r.page === 0).slice(0, 4);
  if (!head.some((r) => text(r).startsWith("Аналитика портфеля"))) {
    throw new ReportFormatError("Это не отчёт ВТБ «Аналитика портфеля». Загрузите отчёт из личного кабинета ВТБ.");
  }

  const periodRow = rows.find((r) => /^За период /.test(text(r)));
  const periodMatch = periodRow ? text(periodRow).match(/За период (\d{2}\.\d{2}\.\d{4}) - (\d{2}\.\d{2}\.\d{4})/) : null;
  if (!periodMatch) throw new ReportFormatError("Формат отчёта не распознан: не найден период отчёта.");
  const periodStart = toIso(periodMatch[1].match(DATE_CELL)!);
  const periodEnd = toIso(periodMatch[2].match(DATE_CELL)!);

  const valueIdx = rows.findIndex((r) => first(r).str.trim() === "Стоимость" && first(r).x < NAME_COLUMN_MAX_X);
  let valueK: number | null = null;
  for (let j = valueIdx + 1; valueIdx >= 0 && j <= valueIdx + 2 && j < rows.length; j++) {
    const c = rows[j].cells.find((x) => isMoneyCell(x.str));
    if (c) {
      valueK = money(c);
      break;
    }
  }
  if (valueK == null) throw new ReportFormatError("Формат отчёта не распознан: не найдена стоимость портфеля.");

  let cashK: number | null = null;
  const positions: ParsedPosition[] = [];
  const totals: ParsedReport["sectionTotals"] = { bond: null, fund: null, stock: null };
  const coupons: ParsedCoupon[] = [];
  const warnings: string[] = [];
  let foreign = false;
  let deposits: { dep: number; wd: number; bank: number } | null = null;
  let fees: { fees: number; taxes: number } | null = null;

  let section: Section = "none";
  let inAssets = false;
  let unknownPayout = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const h = headingOf(row);
    if (h) {
      unknownPayout = false;
      if (h === "Деньги") section = "cash";
      else if (h === "Доход по активам") {
        inAssets = true;
        section = "none";
      } else if (h === "Облигации") section = inAssets ? "bond" : "none";
      else if (h === "Фонды") section = inAssets ? "fund" : "none";
      else if (h === "Акции") section = inAssets ? "stock" : "none";
      else if (h === "Полученные выплаты") section = "payouts";
      else if (h === "Купоны") section = "coupons";
      else if (h === "Пополнения и выводы") section = "deposits";
      else if (h === "Комиссии и налоги") section = "fees";
      else section = "none";
      continue;
    }
    const c0 = first(row);
    const label = c0.str.trim();
    if (section === "done") break;
    if (section === "fees") {
      const vals = row.cells.filter((c) => isMoneyCell(c.str) || isDash(c.str));
      if (vals.length >= 6 && !fees) {
        const [broker, exch, margin, other, taxes, total] = vals.map(moneyOrDash);
        const feesK = Math.abs(broker) + Math.abs(exch) + Math.abs(margin) + Math.abs(other);
        const taxesK = Math.abs(taxes);
        if (Math.abs(Math.abs(total) - (feesK + taxesK)) > 100) {
          throw new ReportFormatError("Формат отчёта не распознан: итог по комиссиям и налогам не сходится со слагаемыми.");
        }
        fees = { fees: feesK, taxes: taxesK };
        section = "done";
      }
      continue;
    }
    switch (section) {
      case "cash": {
        const m = row.cells.find((c) => isMoneyCell(c.str));
        if (!m || c0.x >= NAME_COLUMN_MAX_X) break;
        if (label === "Рубль РФ") cashK = money(m);
        else if (label !== "Наименование") foreign = true;
        break;
      }
      case "bond":
      case "fund":
      case "stock": {
        if (label === "Итого") {
          const m = row.cells.find((c) => isMoneyCell(c.str));
          if (m) totals[section] = money(m);
          break;
        }
        const moneyCells = row.cells.filter((c) => isMoneyCell(c.str));
        const hasShare = row.cells.some((c) => SHARE_CELL.test(c.str.trim()));
        if (c0.x < NAME_COLUMN_MAX_X && moneyCells.length >= 2 && hasShare && !isMoneyCell(c0.str)) {
          let name = label;
          let quantity: number | null = null;
          let j = i + 1;
          for (; j < rows.length && j <= i + 4; j++) {
            const next = rows[j].cells[0];
            if (!next || next.x >= NAME_COLUMN_MAX_X) continue;
            const q = next.str.trim().match(QTY_CELL);
            if (q) {
              quantity = Number(q[1].replace(/[\s  ]/g, ""));
              break;
            }
            if (headingOf(rows[j]) || next.str.trim() === "Итого") break;
            name += ` ${next.str.trim()}`;
          }
          if (quantity == null) throw new ReportFormatError(`Формат отчёта не распознан: у бумаги «${cleanName(name)}» не найдено количество.`);
          positions.push({ name: cleanName(name), type: ASSET_TYPE[section], quantity, valueK: money(moneyCells[0]) });
          i = j;
        }
        break;
      }
      case "payouts":
      case "coupons": {
        if (row.cells.length === 1 && c0.x < 40 && label !== "Итого") {
          warnings.push(`Раздел «${label}» не поддерживается: суммы из него не учтены.`);
          unknownPayout = true;
          break;
        }
        if (section === "payouts" || unknownPayout) break;
        const dateCell = row.cells.find((c) => DATE_CELL.test(c.str.trim()));
        if (!dateCell || c0.x >= NAME_COLUMN_MAX_X || label === "Итого") break;
        const amounts = row.cells.filter((c) => isMoneyCell(c.str));
        const others = row.cells.filter((c) => c !== c0 && c !== dateCell && !isMoneyCell(c.str) && !isDash(c.str));
        if (!amounts.length) throw new ReportFormatError(`Формат отчёта не распознан: у купона «${cleanName(label)}» нет суммы в рублях.`);
        if (others.length) foreign = true;
        coupons.push({ name: cleanName(label), date: toIso(dateCell.str.trim().match(DATE_CELL)!), amountK: money(amounts[0]) });
        break;
      }
      case "deposits": {
        if (c0.x >= NAME_COLUMN_MAX_X) break;
        const vals = row.cells.slice(1);
        if (label === "Рубль РФ") {
          if (vals.length < 4 || !vals.every((c) => isMoneyCell(c.str) || isDash(c.str))) {
            throw new ReportFormatError("Формат отчёта не распознан: таблица «Пополнения и выводы» изменилась.");
          }
          deposits = { dep: moneyOrDash(vals[0]), wd: moneyOrDash(vals[1]), bank: moneyOrDash(vals[2]) };
        } else if (label === "Доллар США" || label === "Евро") {
          if (vals.some((c) => !isDash(c.str))) foreign = true;
        }
        break;
      }
      default:
        break;
    }
  }

  if (cashK == null) throw new ReportFormatError("Формат отчёта не распознан: не найден остаток денег.");
  if (!deposits) throw new ReportFormatError("Формат отчёта не распознан: не найден раздел «Пополнения и выводы».");

  return {
    source: "pdf",
    parserVersion: PDF_PARSER_VERSION,
    periodStart,
    periodEnd,
    valueK,
    cashK,
    positions,
    sectionTotals: totals,
    coupons,
    depositK: Math.abs(deposits.dep),
    withdrawalK: Math.abs(deposits.wd),
    bankPayoutK: Math.abs(deposits.bank),
    feesK: fees?.fees ?? 0,
    taxesK: fees?.taxes ?? 0,
    foreign,
    warnings,
  };
}
