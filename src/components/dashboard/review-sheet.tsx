"use client";

import { useMemo, useState } from "react";
import { saveSnapshotAction } from "@/app/actions/data";
import { CloseIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import type { AppData } from "@/lib/app-types";
import { dmy, monthLabel, rub } from "@/lib/format";
import { evaluateDraft, type Draft, type DraftPosition } from "@/lib/review-model";

type Props = { draft: Draft; data: AppData; expectMonth?: string; onClose: () => void; onSaved: () => void };

const TYPE_LABEL = { bond: "Облигация", fund: "Фонд", stock: "Акция" } as const;

/** Экран проверки: распознанное можно поправить, сохранить нельзя при ошибке. Сервер проверяет всё заново. */
export function ReviewSheet({ draft: initial, data, expectMonth, onClose, onSaved }: Props) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const toast = useToast();
  const existing = useMemo(() => data.snapshots.map((s) => ({ month: s.month, periodEnd: s.periodEnd })), [data.snapshots]);
  const r = useMemo(() => evaluateDraft(d, existing), [d, existing]);
  const errors = [...r.errors];
  if (expectMonth && r.month && r.month !== expectMonth) errors.push(`Это отчёт за ${monthLabel(r.month)}, а заменяется ${monthLabel(expectMonth)}. Загрузите отчёт за нужный месяц.`);
  const mode = r.month && existing.some((e) => e.month === r.month) ? "Актуализировать данные" : "Отметить месяц";
  const set = (patch: Partial<Draft>) => {
    setServerError(null);
    setD((prev) => ({ ...prev, ...patch }));
  };
  const setPos = (i: number, patch: Partial<DraftPosition>) => set({ positions: d.positions.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const known = new Set(data.coupons.map((c) => `${c.name.toLowerCase()}|${c.date}|${c.amountK}`));

  async function save() {
    if (!r.input || errors.length) return;
    setSaving(true);
    const res = await saveSnapshotAction(r.input);
    setSaving(false);
    if (res.ok) {
      toast(mode === "Актуализировать данные" ? `Снимок за ${monthLabel(r.month!)} обновлён` : `Снимок за ${monthLabel(r.month!)} сохранён`);
      onSaved();
    } else setServerError(res.error);
  }

  const sumOk = !errors.some((e) => e.startsWith("Позиции и деньги"));
  const totalsOk = !errors.some((e) => e.startsWith("Итог раздела") || e.includes("строка «Итого»"));
  const ownK = r.contributionK == null ? null : Math.max(0, r.contributionK - (r.input?.deductionK ?? 0));

  return (
    <div className="ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Проверка отчёта">
        <div className="sheet-head">
          <h2>Проверьте отчёт</h2>
          <button className="ibtn" type="button" aria-label="Закрыть" onClick={onClose}><CloseIcon /></button>
        </div>
        <span className="mode">{mode}</span>

        <div className="grid2">
          <div className="fld">
            <label>Месяц снимка</label>
            <div className="inp" style={{ display: "flex", alignItems: "center" }}>{r.month ? monthLabel(r.month) : "—"}</div>
          </div>
          <div className="fld">
            <label>Дата снимка</label>
            <div className="inp num" style={{ display: "flex", alignItems: "center" }}>{dmy(d.periodEnd)}</div>
          </div>
        </div>
        {d.manual ? (
          <div className="grid2">
            <div className="fld"><label htmlFor="rv-ps">Период с</label><input className="inp" id="rv-ps" type="date" value={d.periodStart} onChange={(e) => set({ periodStart: e.target.value, flowDate: e.target.value })} /></div>
            <div className="fld"><label htmlFor="rv-pe">Период по</label><input className="inp" id="rv-pe" type="date" value={d.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} /></div>
          </div>
        ) : (
          <div className="note">Период отчёта {dmy(d.periodStart)} – {dmy(d.periodEnd)}</div>
        )}

        <div className="grid2">
          <div className="fld"><label htmlFor="rv-value">Стоимость, ₽</label><input className="inp num" id="rv-value" inputMode="decimal" value={d.value} onChange={(e) => set({ value: e.target.value })} /></div>
          <div className="fld"><label htmlFor="rv-cash">Деньги, ₽</label><input className="inp num" id="rv-cash" inputMode="decimal" value={d.cash} onChange={(e) => set({ cash: e.target.value })} /></div>
        </div>

        <div className="grp">
          <h3>Взнос месяца</h3>
          <div className="grid2">
            <div className="fld"><label htmlFor="rv-deposit">Пополнения в отчёте, ₽</label><input className="inp num" id="rv-deposit" inputMode="decimal" value={d.deposit} onChange={(e) => set({ deposit: e.target.value })} /></div>
            <div className="fld"><label htmlFor="rv-contrib">Взнос вручную, ₽</label><input className="inp num" id="rv-contrib" inputMode="decimal" placeholder="авто" value={d.contributionOverride} onChange={(e) => set({ contributionOverride: e.target.value })} /></div>
          </div>
          <div className="calc"><div><span>Взнос месяца</span><b className="num">{r.contributionK == null ? "—" : rub(r.contributionK)}</b></div></div>
          <div className="grid2">
            <div className="fld"><label htmlFor="rv-ded">Из них налоговый вычет, ₽</label><input className="inp num" id="rv-ded" inputMode="decimal" value={d.deduction} onChange={(e) => set({ deduction: e.target.value })} /></div>
            <div className="fld"><label htmlFor="rv-wd">Вывод, ₽</label><input className="inp num" id="rv-wd" inputMode="decimal" value={d.withdrawal} onChange={(e) => set({ withdrawal: e.target.value })} /></div>
          </div>
          <div className="fld"><label htmlFor="rv-flow">Дата взноса</label><input className="inp num" id="rv-flow" type="date" min={d.periodStart} max={d.periodEnd} value={d.flowDate} onChange={(e) => set({ flowDate: e.target.value })} /></div>
          <div className="sum">Во «вложено своих» войдёт <b className="num">{ownK == null ? "—" : rub(ownK)}</b></div>
        </div>

        <div className="grp">
          <h3>Позиции</h3>
          {d.positions.map((p, i) => (
            <div className="pos" key={i}>
              <div className="pos-h">
                {d.manual ? <input className="inp sm" aria-label="Название бумаги" placeholder="Название" value={p.name} onChange={(e) => setPos(i, { name: e.target.value })} /> : <b>{p.name}</b>}
                <span>{TYPE_LABEL[p.type]}</span>
              </div>
              <div className="pos-f">
                <div className="fld"><label htmlFor={`rv-q${i}`}>Количество</label><input className="inp sm num" id={`rv-q${i}`} inputMode="numeric" value={p.quantity} onChange={(e) => setPos(i, { quantity: e.target.value })} /></div>
                <div className="fld"><label htmlFor={`rv-v${i}`}>Стоимость, ₽</label><input className="inp sm num" id={`rv-v${i}`} inputMode="decimal" value={p.value} onChange={(e) => setPos(i, { value: e.target.value })} /></div>
                <div className="fld">
                  <label htmlFor={`rv-k${i}`}>Класс</label>
                  <select className="inp sm" id={`rv-k${i}`} value={p.classId ?? ""} onChange={(e) => setPos(i, { classId: e.target.value || null })}>
                    <option value="">Выберите класс</option>
                    {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {d.manual && (
                  <div className="fld">
                    <label htmlFor={`rv-t${i}`}>Вид</label>
                    <select className="inp sm" id={`rv-t${i}`} value={p.type} onChange={(e) => setPos(i, { type: e.target.value as DraftPosition["type"] })}>
                      <option value="bond">Облигация</option><option value="fund">Фонд</option><option value="stock">Акция</option>
                    </select>
                  </div>
                )}
              </div>
              {d.manual && <button className="danger" type="button" onClick={() => set({ positions: d.positions.filter((_, j) => j !== i) })}>Убрать бумагу</button>}
            </div>
          ))}
          {d.manual && <button className="linkbtn" type="button" onClick={() => set({ positions: [...d.positions, { name: "", type: "bond", quantity: "1", value: "", classId: null }] })}>Добавить бумагу</button>}
        </div>

        <div className="grp">
          <h3>Новые купоны</h3>
          {d.coupons.length === 0 && <div className="ok">Новых купонов нет</div>}
          {d.coupons.map((c) => {
            const dup = known.has(`${c.name.toLowerCase()}|${c.date}|${c.amountK}`);
            return <div className="ok" key={`${c.name}${c.date}${c.amountK}`}>{c.name} · {dmy(c.date)} · {rub(c.amountK, { exact: true })}{dup ? " (уже есть, пропущен)" : ""}</div>;
          })}
        </div>

        <div className="grp">
          <h3>Проверки</h3>
          {d.parserVersion !== "manual" && <div className="ok">✓ Документ «Аналитика портфеля» ВТБ</div>}
          {r.month && <div className="ok">✓ Период — один календарный месяц</div>}
          {sumOk && <div className="ok">✓ Позиции + деньги = стоимость (допуск ±1 ₽)</div>}
          {sumOk && totalsOk && <div className="ok">✓ Итоги разделов сходятся</div>}
          {errors.map((e) => <div className="err" role="alert" key={e}>{e}</div>)}
          {serverError && <div className="err" role="alert">{serverError}</div>}
          {r.warnings.map((w) => <div className="warn" key={w}>{w}</div>)}
        </div>

        <div className="acts">
          <button className="btn fill" type="button" disabled={saving || errors.length > 0 || !r.input} onClick={save}>{saving ? "Сохраняю…" : "Сохранить"}</button>
          <button className="btn ghost" type="button" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
