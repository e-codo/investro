"use client";

import { Fill, Section } from "@/components/reveal";
import { dmy, percent, rub } from "@/lib/format";
import type { Model } from "./model";

export function GoalBlock({ m, goalK }: { m: Model; goalK: number }) {
  return (
    <Section>
      <div className="sec-h">
        <span className="lbl">Прогресс к цели</span>
      </div>
      <div className="prog">
        <div>
          <div className="prog-h">
            <div>
              <span className="lbl">Цель</span>
              <b className="num">{rub(goalK)}</b>
            </div>
            <span className="p num">{percent(m.goalPct)}</span>
          </div>
          <div className="track">
            <Fill percent={m.goalPct} />
          </div>
          <div className="prog-s num">Осталось {rub(m.goalLeftK)}</div>
        </div>
      </div>
    </Section>
  );
}

export function MilestonesBlock({ m }: { m: Model }) {
  const value = m.last?.valueK ?? 0;
  const next = m.milestones.find((x) => x.state === "next");
  const prev = [...m.milestones].reverse().find((x) => x.state === "done");
  const pct = next ? ((value - (prev?.amountK ?? 0)) / (next.amountK - (prev?.amountK ?? 0))) * 100 : 0;
  return (
    <Section>
      <div className="sec-h">
        <span className="lbl">Вехи</span>
      </div>
      <ul className="chips pop">
        {m.milestones.map((x, i) => (
          <li key={x.amountK} className={x.state === "done" ? "done" : x.state === "next" ? "next" : ""} style={{ "--d": `${i * 60}ms` } as React.CSSProperties}>
            {rub(x.amountK)}
            {x.date ? ` · ${dmy(x.date)}` : ""}
          </li>
        ))}
      </ul>
      {next && (
        <div style={{ marginTop: 28 }}>
          <div className="track thin">
            <Fill percent={pct} />
          </div>
          <div className="prog-s num">
            До {rub(next.amountK)} осталось {rub(next.amountK - value)}
          </div>
        </div>
      )}
    </Section>
  );
}
