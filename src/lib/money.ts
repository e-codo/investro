// Деньги везде целыми копейками. Эти функции только переводят текст отчёта и ввод пользователя.

const SPACES = /[\s   ]/g;

/** Ячейка с суммой в рублях: «+36 000,00 ₽», «−34,25 ₽», «256,44 ₽». */
export const MONEY_CELL = /^[+\-−]?\s*\d[\d\s   ]*,\d{2}\s*₽$/;

export const isMoneyCell = (s: string) => MONEY_CELL.test(s.trim());
export const isDash = (s: string) => /^[-−–—]$/.test(s.trim());

/** «+36 000,00 ₽» → 3600000. Знак сохраняется. */
export function parseMoneyCell(s: string): number {
  const t = s.trim().replace(SPACES, "").replace("₽", "").replace("−", "-");
  const v = Number(t.replace(",", "."));
  if (!Number.isFinite(v)) throw new Error(`Не число: «${s}»`);
  return Math.round(v * 100);
}

/** Ввод пользователя «36 237,86» или «36237.86» → копейки, либо null, если это не число. */
export function parseRublesInput(input: string): number | null {
  const t = input.replace(SPACES, "").replace(",", ".");
  if (t === "" || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Копейки → «36237,86» для полей ввода (точное значение, с копейками). */
export const toInputValue = (k: number) => (k / 100).toFixed(2).replace(".", ",");
