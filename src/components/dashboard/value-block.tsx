"use client";

import { Count, Section } from "@/components/reveal";
import { percent, pointsDiff, rub } from "@/lib/format";
import type { Model } from "./model";

export function ValueBlock({ m, onUpload }: { m: Model; onUpload: () => void }) {
  const last = m.last;
  return (
    <Section className="val">
      <span className="lbl">Стоимость портфеля</span>
      {last ? (
        <div className="big num">
          <Count value={last.valueK} format={(v) => rub(v)} />
        </div>
      ) : (
        <div className="empty">
          <div className="big num">—</div>
          <p className="sum">Загрузите первый отчёт</p>
          <button className="btn fill" type="button" onClick={onUpload}>
            Загрузить отчёт
          </button>
        </div>
      )}
      <dl className="kv">
        <div>
          <dt>Вложено своих</dt>
          <dd>
            <b className="num">{last ? rub(m.invested) : "—"}</b>
          </dd>
        </div>
        <div>
          <dt>Прибыль</dt>
          <dd>
            <b className="num">{last ? rub(m.profit, { sign: true }) : "—"}</b>
            {last && m.profitPct != null && <i>{percent(m.profitPct)}</i>}
          </dd>
        </div>
        <div>
          <dt>Получено вычетов</dt>
          <dd>
            <b className="num">{last ? rub(m.deductions) : "—"}</b>
          </dd>
        </div>
        <div>
          <dt>Годовая доходность</dt>
          <dd>
            <b className="num">{m.yearly == null ? "—" : percent(m.yearly)}</b>
            {m.vsDeposit != null && m.vsInflation != null && (
              <i>
                {pointsDiff(m.vsDeposit)} к вкладу · {pointsDiff(m.vsInflation)} к инфляции
              </i>
            )}
          </dd>
        </div>
      </dl>
    </Section>
  );
}
