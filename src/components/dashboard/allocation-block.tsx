"use client";

import { Fill, Section } from "@/components/reveal";
import { dmy, percent, pointsDiff, rub } from "@/lib/format";
import type { Model } from "./model";

export function AllocationBlock({ m }: { m: Model }) {
  const last = m.last;
  return (
    <Section>
      <div className="sec-h"><span className="lbl">Аллокация</span></div>
      {m.alloc.map((r) => (
        <div className="arow" key={r.classId}>
          <div className="a-top">
            <span className="a-name">{r.name}</span>
            <span className="a-pct num">{percent(r.share)}<small>{rub(r.valueK)}</small></span>
          </div>
          <div className="a-track">
            <Fill percent={r.share} />
            <u style={{ left: `${r.weight}%` }} />
          </div>
          <div className="a-sub">
            <span>В стратегии <b className="num">{percent(r.weight)}</b></span>
            <span>Отклонение <b className="num">{pointsDiff(r.deviation)}</b></span>
          </div>
        </div>
      ))}
      {m.unassignedK > 0 && (
        <div className="arow">
          <div className="a-top"><span className="a-name">Без класса</span><span className="a-pct num"><small>{rub(m.unassignedK)}</small></span></div>
        </div>
      )}
      {last && (
        <div className="arow">
          <div className="a-top">
            <span className="a-name">Деньги на счёте</span>
            <span className="a-pct num">{rub(last.cashK)}<small>{percent(m.cashPct)} портфеля</small></span>
          </div>
        </div>
      )}
      {last && <p className="anote">По рыночной стоимости на {dmy(last.periodEnd)}</p>}
    </Section>
  );
}
