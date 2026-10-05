// Формулы раздела 4 ТЗ. Чистые функции, деньги в копейках, расчёты без округления.
import { addMonths, daysBetween, monthIndex } from "./dates";

export type Snap = {
  month: string; // ГГГГ-ММ
  periodEnd: string; // дата снимка
  valueK: number;
  cashK: number;
  contributionK: number;
  deductionK: number;
  withdrawalK: number;
  /** Дата взноса для XIRR. */
  flowDate: string;
};

/** Взнос своих = взнос месяца − вычет. */
export const ownContribution = (s: Snap) => s.contributionK - s.deductionK;

export const sortSnaps = (S: Snap[]) => [...S].sort((a, b) => (a.month < b.month ? -1 : 1));

export const investedOwn = (S: Snap[]) => S.reduce((a, s) => a + ownContribution(s) - s.withdrawalK, 0);
export const deductionsTotal = (S: Snap[]) => S.reduce((a, s) => a + s.deductionK, 0);
export const profitK = (S: Snap[]) => (S.length ? sortSnaps(S).at(-1)!.valueK - investedOwn(S) : 0);
/** Прибыль ÷ вложено своих × 100; null, если вложено 0. */
export const profitPercent = (S: Snap[]) => {
  const inv = investedOwn(S);
  return inv > 0 ? (profitK(S) / inv) * 100 : null;
};

export type Flow = { date: string; amountK: number };
export function flowsOf(S: Snap[]): Flow[] {
  const sorted = sortSnaps(S);
  const flows: Flow[] = sorted.map((s) => ({ date: s.flowDate, amountK: -(ownContribution(s) - s.withdrawalK) }));
  const last = sorted.at(-1);
  if (last) flows.push({ date: last.periodEnd, amountK: last.valueK });
  return flows;
}

/** XIRR, % годовых. null, если решения нет. */
export function xirr(flows: Flow[]): number | null {
  if (flows.length < 2) return null;
  const sorted = [...flows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const t0 = sorted[0].date;
  const npv = (r: number) => sorted.reduce((a, f) => a + f.amountK / Math.pow(1 + r, daysBetween(t0, f.date) / 365), 0);
  let lo = -0.95;
  let hi = 20;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}

export const MIN_HISTORY_DAYS = 90;

/** Годовая доходность: показывается от 90 дней между первым взносом и последним снимком, раньше null. */
export function yearlyReturn(S: Snap[]): number | null {
  if (!S.length) return null;
  const flows = flowsOf(S);
  const first = [...flows].sort((a, b) => (a.date < b.date ? -1 : 1))[0].date;
  if (daysBetween(first, sortSnaps(S).at(-1)!.periodEnd) < MIN_HISTORY_DAYS) return null;
  return xirr(flows);
}

export const goalProgress = (valueK: number, goalK: number) => (goalK > 0 ? Math.min(100, (valueK / goalK) * 100) : 0);

export type MilestoneStatus = { amountK: number; state: "done" | "next" | "future"; date: string | null };
export function milestoneStates(S: Snap[], amounts: number[]): MilestoneStatus[] {
  const sorted = sortSnaps(S);
  const value = sorted.at(-1)?.valueK ?? 0;
  const list = [...amounts].sort((a, b) => a - b);
  const next = list.find((m) => m > value);
  return list.map((m) => {
    if (m <= value) return { amountK: m, state: "done", date: sorted.find((s) => s.valueK >= m)?.periodEnd ?? null };
    return { amountK: m, state: m === next ? "next" : "future", date: null };
  });
}

/** Месяц со взносом: взнос своих > 0 (месяц только с вычетом не считается). */
export const paidMonths = (S: Snap[]) => new Set(S.filter((s) => ownContribution(s) > 0).map((s) => s.month));

/** Серия: месяцев подряд со взносом, считая от текущего или прошлого. */
export function streak(S: Snap[], currentMonth: string): number {
  const paid = paidMonths(S);
  let m = paid.has(currentMonth) ? currentMonth : addMonths(currentMonth, -1);
  let n = 0;
  while (paid.has(m)) {
    n++;
    m = addMonths(m, -1);
  }
  return n;
}

export type ClassRow = { classId: string; name: string; valueK: number; share: number; weight: number; deviation: number };
/** Доля класса от суммы позиций без денег; в сумме 100%. Деньги отдельно. */
export function allocation(classes: { id: string; name: string; weight: number }[], positions: { classId: string | null; valueK: number }[]): ClassRow[] {
  const total = positions.reduce((a, p) => a + p.valueK, 0);
  return classes.map((c) => {
    const v = positions.filter((p) => p.classId === c.id).reduce((a, p) => a + p.valueK, 0);
    const share = total > 0 ? (v / total) * 100 : 0;
    return { classId: c.id, name: c.name, valueK: v, share, weight: c.weight, deviation: share - c.weight };
  });
}

export const cashShare = (cashK: number, valueK: number) => (valueK > 0 ? (cashK / valueK) * 100 : 0);

export type CouponRow = { date: string; amountK: number };
/** Купоны по месяцам ГГГГ-ММ (факт). */
export function couponsByMonth(coupons: CouponRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of coupons) m.set(c.date.slice(0, 7), (m.get(c.date.slice(0, 7)) ?? 0) + c.amountK);
  return m;
}

export const monthsBetween = (a: string, b: string) => monthIndex(b) - monthIndex(a);
