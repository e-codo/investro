const ekbDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yekaterinburg", year: "numeric", month: "2-digit", day: "2-digit" });

/** Сегодняшняя дата в Екатеринбурге, формат ГГГГ-ММ-ДД. */
export function todayEkb(now: Date = new Date()): string {
  return ekbDate.format(now);
}

export const monthOf = (iso: string) => iso.slice(0, 7);

/** Номер месяца подряд: 2026-09 → 2026*12+8. */
export const monthIndex = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
};
export const fromMonthIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
export const addMonths = (ym: string, n: number) => fromMonthIndex(monthIndex(ym) + n);

export const daysBetween = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;

/** Середина периода: дата взноса по умолчанию для расчёта доходности. */
export function midDate(start: string, end: string): string {
  return new Date((Date.parse(`${start}T00:00:00Z`) + Date.parse(`${end}T00:00:00Z`)) / 2).toISOString().slice(0, 10);
}

/** Начало и конец периода лежат в одном календарном месяце. */
export const isSingleMonth = (start: string, end: string) => start <= end && monthOf(start) === monthOf(end);
