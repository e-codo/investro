// Показ чисел. На экране суммы в целых рублях, проценты в целых, дробная часть отбрасывается (вниз по модулю).
// Это только отображение: хранение и расчёты идут в копейках без округления. exact — для полей ввода и сообщений проверок.
const NBSP = " ";
const nf = new Intl.NumberFormat("ru-RU");
const nf2 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nb = (s: string) => s.replace(/[\s ]/g, NBSP);

/** 3623786 → «36 237 ₽»; sign добавляет «+»; знак у нуля после отбрасывания не показывается. */
export function rub(kopecks: number, opts: { sign?: boolean; exact?: boolean } = {}): string {
  const a = Math.abs(kopecks);
  const whole = Math.floor(a / 100);
  const zero = opts.exact ? a === 0 : whole === 0;
  const body = opts.exact ? nf2.format(a / 100) : nf.format(whole);
  return nb(`${zero ? "" : kopecks < 0 ? "−" : opts.sign ? "+" : ""}${body} ₽`);
}

const whole = (x: number) => Math.floor(Math.abs(x));
/** 60.4 → «60%», −0.4 → «0%». */
export const percent = (x: number) => nb(`${whole(x) > 0 && x < 0 ? "−" : ""}${nf.format(whole(x))}%`);
/** +1.8 → «+1 п.п.» */
export const pointsDiff = (x: number) => nb(`${whole(x) > 0 ? (x < 0 ? "−" : "+") : ""}${nf.format(whole(x))} п.п.`);

export const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const MONTH_LETTERS = ["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"];

/** «2026-09-30» → «30.09.2026» */
export function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** «2026-09» → «сентябрь 2026» */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
