"use client";

import { useState } from "react";
import { deleteSnapshotAction } from "@/app/actions/data";
import { useToast } from "@/components/toast";
import { Section } from "@/components/reveal";
import { useRouter } from "next/navigation";
import type { AppData, SnapshotDTO } from "@/lib/app-types";
import { ownContribution } from "@/lib/portfolio";
import { toSnap, type Model } from "./model";
import { MONTH_LETTERS, dmy, monthLabel, rub } from "@/lib/format";

function monthKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function CalendarBlock({ data, m, onReplace }: { data: AppData; m: Model; onReplace: (month: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const curYear = Number(m.currentMonth.slice(0, 4));
  const years = [curYear - 2, curYear - 1, curYear];
  const by = new Map(data.snapshots.map((s) => [s.month, s]));
  const selected = sel ? by.get(sel) : null;

  async function remove(month: string) {
    setBusy(true);
    const res = await deleteSnapshotAction(month);
    setBusy(false);
    if (res.ok) {
      setSel(null);
      setAsk(false);
      toast("Снимок удалён");
      router.refresh();
    } else toast(res.error);
  }

  return (
    <Section>
      <div className="sec-h">
        <span className="lbl">Календарь взносов</span>
        <span className="streak">{m.streak} мес. подряд без пропусков</span>
      </div>
      <div className="heat">
        <span />
        {MONTH_LETTERS.map((l, i) => (
          <span key={i} className="mh">
            {l}
          </span>
        ))}
        {years.map((y) => [
          <span key={`y${y}`} className="yl">
            {y}
          </span>,
          ...Array.from({ length: 12 }, (_, i) => {
            const k = monthKey(y, i + 1);
            const s = by.get(k);
            const cls = ["cell", s ? (ownContribution(toSnap(s)) > 0 ? "paid" : "val") : "", k > m.currentMonth ? "future" : "", k === m.currentMonth ? "now" : "", k === sel ? "sel" : ""].filter(Boolean).join(" ");
            return s ? (
              <button key={k} type="button" className={cls} aria-label={`${monthLabel(k)}: снимок`} onClick={() => { setSel(sel === k ? null : k); setAsk(false); }} />
            ) : (
              <span key={k} className={cls} />
            );
          }),
        ])}
      </div>
      <p className="cap" />
      {selected && <MonthCard s={selected} data={data} ask={ask} busy={busy} onAsk={setAsk} onReplace={() => onReplace(selected.month)} onDelete={() => remove(selected.month)} />}
    </Section>
  );
}

function MonthCard({ s, data, ask, busy, onAsk, onReplace, onDelete }: { s: SnapshotDTO; data: AppData; ask: boolean; busy: boolean; onAsk: (v: boolean) => void; onReplace: () => void; onDelete: () => void }) {
  const coupons = data.coupons.filter((c) => c.date.startsWith(s.month));
  const couponSum = coupons.reduce((a, c) => a + c.amountK, 0);
  return (
    <div className="mcard">
      <h3>{monthLabel(s.month)}</h3>
      <ul>
        <li><span>Период отчёта</span><span className="num">{dmy(s.periodStart)} – {dmy(s.periodEnd)}</span></li>
        <li><span>Стоимость</span><span className="num">{rub(s.valueK)}</span></li>
        <li><span>Взнос месяца</span><span className="num">{rub(s.contributionK)}{s.deductionK ? ` (вычет ${rub(s.deductionK)})` : ""}</span></li>
        <li><span>Купоны месяца</span><span className="num">{coupons.length ? rub(couponSum) : "нет"}</span></li>
      </ul>
      <span className="lbl">Позиции</span>
      <ul>
        {s.positions.map((p) => (
          <li key={p.instrumentId}><span>{p.name}</span><span className="num">{p.quantity} шт. · {rub(p.valueK)}</span></li>
        ))}
      </ul>
      {ask ? (
        <>
          <div className="warn">Удалить снимок за {monthLabel(s.month)}? Взносы других месяцев не изменятся.</div>
          <div className="acts">
            <button type="button" className="btn fill" disabled={busy} onClick={onDelete}>Да, удалить</button>
            <button type="button" className="btn ghost" onClick={() => onAsk(false)}>Отмена</button>
          </div>
        </>
      ) : (
        <div className="acts">
          <button type="button" className="btn" onClick={onReplace}>Заменить отчёт</button>
          <button type="button" className="danger" onClick={() => onAsk(true)}>Удалить снимок</button>
        </div>
      )}
    </div>
  );
}
