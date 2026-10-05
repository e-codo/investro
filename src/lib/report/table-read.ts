import { ReportFormatError } from "./types";
import { SHEET_NAMES, type Cell, type TableSheets } from "./table-parse";

/** Читает .xlsx в браузере (read-excel-file). Файл никуда не отправляется. */
export async function readTableSheets(file: File | Blob): Promise<TableSheets> {
  const { default: readXlsx, readSheetNames } = await import("read-excel-file");
  let names: string[];
  try {
    names = await readSheetNames(file);
  } catch {
    throw new ReportFormatError("Не удалось открыть файл. Нужна таблица .xlsx по шаблону.");
  }
  for (const n of Object.values(SHEET_NAMES)) {
    if (!names.includes(n)) throw new ReportFormatError(`В таблице нет листа «${n}». Используйте шаблон из личного кабинета.`);
  }
  const read = (sheet: string) => readXlsx(file, { sheet }) as Promise<Cell[][]>;
  return { report: await read(SHEET_NAMES.report), positions: await read(SHEET_NAMES.positions), coupons: await read(SHEET_NAMES.coupons) };
}
