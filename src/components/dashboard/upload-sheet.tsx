"use client";

import { useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { parsePdfItems } from "@/lib/report/pdf-parse";
import { readPdfItems } from "@/lib/report/pdf-read";
import { parseTableSheets } from "@/lib/report/table-parse";
import { readTableSheets } from "@/lib/report/table-read";
import { ReportFormatError, type ParsedReport } from "@/lib/report/types";

/** Окно «Загрузите отчёт»: PDF или таблица .xlsx разбираются в браузере, файл на сервер не уходит. */
export function UploadSheet({ onClose, onParsed, onManual }: { onClose: () => void; onParsed: (r: ParsedReport) => void; onManual: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".pdf") || file.type === "application/pdf") onParsed(parsePdfItems(await readPdfItems(file)));
      else if (name.endsWith(".xlsx")) onParsed(parseTableSheets(await readTableSheets(file)));
      else setError("Нужен PDF отчёта ВТБ или таблица .xlsx по шаблону.");
    } catch (e) {
      if (e instanceof ReportFormatError) setError(e.message);
      else {
        console.error(e);
        setError("Формат отчёта не распознан. Загрузите таблицу по шаблону или заполните данные вручную.");
      }
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Загрузка отчёта">
        <div className="sheet-head">
          <h2>Загрузите отчёт</h2>
          <button className="ibtn" type="button" aria-label="Закрыть" onClick={onClose}><CloseIcon /></button>
        </div>
        <p className="sum">Отчёт ВТБ за один календарный месяц: с 1-го числа по последнее, для текущего месяца по сегодня. Файл читается в браузере и на сервер не отправляется.</p>
        <label
          className={`drop${over ? " over" : ""}`}
          htmlFor="report-file"
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files[0]); }}
        >
          <b>{busy ? "Читаю файл…" : "Перетащите файл или выберите"}</b>
          <span className="note">PDF отчёта или таблица .xlsx по шаблону</span>
          <span className="btn fill" role="button">Выбрать файл</span>
          <input ref={input} id="report-file" type="file" accept=".pdf,.xlsx" hidden onChange={(e) => void handle(e.target.files?.[0])} />
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="grp">
          <h3>Если формат PDF изменился</h3>
          <p className="note" style={{ margin: 0 }}>Загрузите таблицу по шаблону.</p>
          <div className="acts">
            <a className="btn" href="/template-report.xlsx" download onClick={() => toast("Шаблон скачивается")}>Скачать шаблон таблицы (.xlsx)</a>
            <button className="linkbtn" type="button" onClick={onManual}>Заполнить вручную</button>
          </div>
        </div>
      </div>
    </div>
  );
}
