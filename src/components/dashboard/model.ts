import type { AppData, SnapshotDTO } from "@/lib/app-types";
import { allocation, cashShare, couponsByMonth, deductionsTotal, goalProgress, investedOwn, milestoneStates, profitK, profitPercent, streak, yearlyReturn, type Snap } from "@/lib/portfolio";
import { monthOf } from "@/lib/dates";

export const toSnap = (s: SnapshotDTO): Snap => ({
  month: s.month, periodEnd: s.periodEnd, valueK: s.valueK, cashK: s.cashK, contributionK: s.contributionK, deductionK: s.deductionK, withdrawalK: s.withdrawalK, flowDate: s.flowDate,
});

/** Все числа главного экрана, посчитанные по формулам раздела 4. */
export function buildModel(d: AppData, today: string) {
  const snaps = d.snapshots.map(toSnap);
  const last = d.snapshots.at(-1) ?? null;
  const yearly = yearlyReturn(snaps);
  const strategyName = d.settings.strategyName?.trim() || d.classes.map((c) => c.weight).join(" / ");
  const positions = last?.positions ?? [];
  const rows = allocation(d.classes, positions);
  const unassignedK = positions.filter((p) => !p.classId || !d.classes.some((c) => c.id === p.classId)).reduce((a, p) => a + p.valueK, 0);
  return {
    snaps,
    last,
    currentMonth: monthOf(today),
    invested: investedOwn(snaps),
    deductions: deductionsTotal(snaps),
    profit: profitK(snaps),
    profitPct: profitPercent(snaps),
    yearly,
    vsDeposit: yearly == null ? null : yearly - d.settings.depositRate,
    vsInflation: yearly == null ? null : yearly - d.settings.inflation,
    goalPct: last ? goalProgress(last.valueK, d.settings.goalK) : 0,
    goalLeftK: last ? Math.max(0, d.settings.goalK - last.valueK) : d.settings.goalK,
    milestones: milestoneStates(snaps, d.milestonesK),
    streak: streak(snaps, monthOf(today)),
    strategyName,
    alloc: rows,
    unassignedK,
    cashPct: last ? cashShare(last.cashK, last.valueK) : 0,
    couponMonths: couponsByMonth(d.coupons),
    hasBonds: positions.some((p) => p.type === "bond"),
  };
}
export type Model = ReturnType<typeof buildModel>;
