// Модель экрана проверки: черновик (поля как строки ввода) ↔ данные для сервера. Чистые функции, без React.
import { addMonths, midDate } from "./dates";
import { checkDraft, type ExistingSnapshot } from "./report/validate";
import { defaultClassId } from "./report/names";
import type { AssetType, ParsedReport } from "./report/types";
import { parseRublesInput, toInputValue } from "./money";
import type { SnapshotInput } from "./schemas";

export type DraftPosition = { name: string; type: AssetType; quantity: string; value: string; classId: string | null };
export type DraftCoupon = { name: string; date: string; amountK: number };
export type Draft = {
  source: "pdf" | "table";
  parserVersion: string;
  /** Ручной ввод: период и состав правятся целиком. */
  manual: boolean;
  periodStart: string;
  periodEnd: string;
  value: string;
  cash: string;
  deposit: string;
  /** Пусто: взнос равен пополнениям отчёта. */
  contributionOverride: string;
  deduction: string;
  withdrawal: string;
  fees: number;
  taxes: number;
  flowDate: string;
  foreign: boolean;
  sectionTotals: { bond: number | null; fund: number | null; stock: number | null };
  positions: DraftPosition[];
  coupons: DraftCoupon[];
  warnings: string[];
};

export function draftFromReport(r: ParsedReport, classes: { id: string; name: string }[], knownClass: (name: string) => string | null): Draft {
  return {
    source: r.source,
    parserVersion: r.parserVersion,
    manual: false,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    value: toInputValue(r.valueK),
    cash: toInputValue(r.cashK),
    deposit: toInputValue(r.depositK),
    contributionOverride: "",
    deduction: "0,00",
    withdrawal: toInputValue(r.withdrawalK + r.bankPayoutK),
    fees: r.feesK,
    taxes: r.taxesK,
    flowDate: midDate(r.periodStart, r.periodEnd),
    foreign: r.foreign,
    sectionTotals: r.sectionTotals,
    positions: r.positions.map((p) => ({ name: p.name, type: p.type, quantity: String(p.quantity), value: toInputValue(p.valueK), classId: knownClass(p.name) ?? defaultClassId(p.name, p.type, classes) })),
    coupons: r.coupons,
    warnings: r.warnings,
  };
}

/** Пустой черновик для ручного заполнения на том же экране. */
export function emptyDraft(today: string): Draft {
  const start = `${today.slice(0, 7)}-01`;
  return {
    source: "pdf", parserVersion: "manual", manual: true, periodStart: start, periodEnd: today, value: "", cash: "", deposit: "0,00", contributionOverride: "", deduction: "0,00", withdrawal: "0,00",
    fees: 0, taxes: 0, flowDate: midDate(start, today), foreign: false, sectionTotals: { bond: null, fund: null, stock: null }, positions: [], coupons: [], warnings: [],
  };
}

export type DraftResult = { input: SnapshotInput | null; month: string | null; errors: string[]; warnings: string[]; contributionK: number | null };

const FIELD = { value: "Стоимость", cash: "Деньги", deposit: "Пополнения", contribution: "Взнос вручную", deduction: "Налоговый вычет", withdrawal: "Вывод" } as const;

/** Превращает черновик в данные для сервера и собирает все ошибки и предупреждения для показа. */
export function evaluateDraft(d: Draft, existing: ExistingSnapshot[]): DraftResult {
  const errors: string[] = [];
  const num = (text: string, label: string, { allowEmpty = false }: { allowEmpty?: boolean } = {}): number | null => {
    if (allowEmpty && text.trim() === "") return null;
    const k = parseRublesInput(text);
    if (k == null) errors.push(`Поле «${label}»: введите сумму числом.`);
    else if (k < 0) errors.push(`Поле «${label}»: сумма не может быть отрицательной.`);
    return k;
  };
  const valueK = num(d.value, FIELD.value);
  const cashK = num(d.cash, FIELD.cash);
  const depositK = num(d.deposit, FIELD.deposit);
  const override = num(d.contributionOverride, FIELD.contribution, { allowEmpty: true });
  const deductionK = num(d.deduction, FIELD.deduction);
  const withdrawalK = num(d.withdrawal, FIELD.withdrawal);
  const positions = d.positions.map((p) => {
    const q = Number(p.quantity.replace(/[\s ]/g, ""));
    const v = parseRublesInput(p.value);
    if (!p.name.trim()) errors.push("У бумаги не заполнено название.");
    if (!Number.isInteger(q) || q <= 0) errors.push(`«${p.name}»: количество должно быть целым числом больше нуля.`);
    if (v == null || v < 0) errors.push(`«${p.name}»: стоимость введите числом.`);
    return { name: p.name.trim(), type: p.type, quantity: q, valueK: v ?? 0, classId: p.classId };
  });
  if (!positions.length) errors.push("В отчёте нет позиций.");
  for (const p of positions) if (!p.classId) errors.push(`Выберите класс для бумаги «${p.name}».`);

  const contributionK = override ?? depositK;
  if (valueK == null || cashK == null || contributionK == null || deductionK == null || withdrawalK == null) {
    return { input: null, month: null, errors, warnings: d.warnings, contributionK: contributionK ?? null };
  }
  // При ручном вводе итогов раздела нет: проверяем по самим позициям.
  const sums = (t: AssetType) => positions.filter((p) => p.type === t).reduce((a, p) => a + p.valueK, 0);
  const sectionTotals = d.manual ? { bond: sums("bond"), fund: sums("fund"), stock: sums("stock") } : d.sectionTotals;
  const check = checkDraft(
    { periodStart: d.periodStart, periodEnd: d.periodEnd, valueK, cashK, positions, sectionTotals, foreign: d.foreign, contributionK, deductionK, withdrawalK },
    existing,
  );
  errors.push(...check.errors);
  if (d.flowDate < d.periodStart || d.flowDate > d.periodEnd) errors.push("Дата взноса должна лежать в периоде отчёта.");
  const input: SnapshotInput = {
    source: d.source, parserVersion: d.parserVersion, periodStart: d.periodStart, periodEnd: d.periodEnd, valueK, cashK,
    reportDepositK: depositK ?? 0, contributionK, deductionK, withdrawalK, feesK: d.fees, taxesK: d.taxes, flowDate: d.flowDate,
    foreign: d.foreign, sectionTotals, positions, coupons: d.coupons,
  };
  return { input, month: check.month, errors: [...new Set(errors)], warnings: [...d.warnings, ...check.warnings], contributionK };
}

/** Предыдущий месяц нужен календарю при пустой истории. */
export const prevMonth = (m: string) => addMonths(m, -1);
