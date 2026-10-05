import { isSingleMonth, monthIndex, monthOf } from "../dates";
import { dmy, monthLabel, rub } from "../format";
import type { ParsedPosition } from "./types";

/** Допуск проверок сумм: ±1 ₽. */
export const SUM_TOLERANCE_K = 100;

export type DraftToCheck = {
  periodStart: string;
  periodEnd: string;
  valueK: number;
  cashK: number;
  positions: Pick<ParsedPosition, "name" | "type" | "valueK">[];
  sectionTotals: { bond: number | null; fund: number | null; stock: number | null };
  foreign: boolean;
  contributionK: number;
  deductionK: number;
  withdrawalK: number;
};
export type ExistingSnapshot = { month: string; periodEnd: string };
export type CheckResult = { month: string | null; errors: string[]; warnings: string[] };

const SECTION_NAME = { bond: "Облигации", fund: "Фонды", stock: "Акции" } as const;

/** Проверки раздела 2.1. Ошибка: сохранить нельзя. Предупреждение: можно, но стоит посмотреть. Одни и те же правила на экране проверки и на сервере. */
export function checkDraft(d: DraftToCheck, existing: ExistingSnapshot[]): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (d.foreign) errors.push("В отчёте есть операции в валюте. Валютные операции не поддерживаются.");

  const singleMonth = isSingleMonth(d.periodStart, d.periodEnd);
  const month = singleMonth ? monthOf(d.periodEnd) : null;
  if (!singleMonth) {
    errors.push(`Отчёт охватывает несколько месяцев (${dmy(d.periodStart)} – ${dmy(d.periodEnd)}). Скачайте отчёт за один месяц: с 1-го по последнее число, для текущего месяца по сегодня.`);
  }

  const positionsSum = d.positions.reduce((a, p) => a + p.valueK, 0);
  const diff = positionsSum + d.cashK - d.valueK;
  if (Math.abs(diff) > SUM_TOLERANCE_K) {
    errors.push(`Позиции и деньги (${rub(positionsSum + d.cashK, { exact: true })}) не сходятся со стоимостью портфеля (${rub(d.valueK, { exact: true })}): разница ${rub(diff, { exact: true, sign: true })}. Проверьте числа или загрузите другой отчёт.`);
  }

  for (const type of ["bond", "fund", "stock"] as const) {
    const sum = d.positions.filter((p) => p.type === type).reduce((a, p) => a + p.valueK, 0);
    const total = d.sectionTotals[type];
    if (total == null) {
      if (sum > 0 && type !== "stock") errors.push(`В разделе «${SECTION_NAME[type]}» не найдена строка «Итого». Проверьте отчёт.`);
      continue;
    }
    if (Math.abs(sum - total) > SUM_TOLERANCE_K) {
      errors.push(`Итог раздела «${SECTION_NAME[type]}» (${rub(total, { exact: true })}) не сходится с суммой позиций (${rub(sum, { exact: true })}).`);
    }
  }

  errors.push(...checkContribution(d));

  if (singleMonth) {
    if (d.periodStart.slice(8) !== "01") warnings.push("Период начинается не с 1-го числа: пополнения до начала периода в отчёте не видны.");
    const others = existing.filter((e) => e.month !== month);
    const before = others.filter((e) => e.month < month!).sort((a, b) => (a.month < b.month ? 1 : -1))[0];
    if (before) {
      const gap = monthIndex(month!) - monthIndex(before.month) - 1;
      if (gap > 0) warnings.push(`За ${gap} мес. между снимками отчётов нет, взносы за них не учтены.`);
    }
    const same = existing.find((e) => e.month === month);
    if (same && d.periodEnd < same.periodEnd) {
      warnings.push(`В снимке за ${monthLabel(month!)} данные на ${dmy(same.periodEnd)}, вы заменяете их более ранними на ${dmy(d.periodEnd)}.`);
    }
    if (!others.length) {
      const own = d.valueK - d.contributionK;
      if (own > d.contributionK * 0.2) {
        warnings.push("Похоже, счёт открыт раньше первого загруженного месяца: «вложено своих» может быть занижено. Загрузите отчёты за более ранние месяцы.");
      }
    }
  }
  return { month, errors, warnings };
}

/** Проверки введённых пользователем сумм: взнос, вычет, вывод. */
export function checkContribution(d: Pick<DraftToCheck, "contributionK" | "deductionK" | "withdrawalK">): string[] {
  const errors: string[] = [];
  if (d.contributionK < 0 || d.withdrawalK < 0 || d.deductionK < 0) errors.push("Взнос, вывод и вычет не могут быть отрицательными.");
  else if (d.deductionK > d.contributionK) errors.push("Налоговый вычет больше взноса месяца.");
  return errors;
}
