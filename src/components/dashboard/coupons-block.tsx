"use client";

import { useState } from "react";
import { LeftIcon, RightIcon } from "@/components/icons";
import { Section } from "@/components/reveal";
import type { AppData } from "@/lib/app-types";
import { addMonths, monthIndex } from "@/lib/dates";
import { MONTHS_SHORT, rub } from "@/lib/format";
import type { Model } from "./model";

type Kind = "past" | "now" | "future" | "none";

function monthCard(ym: string, kind: Kind, sum: number, names: string[], i: number) {
  const [y, mo] = ym.split("-").map(Number);
  const cls = kind === "past" ? "past" : kind === "now" ? "now" : "off";
  const tag = kind === "past" ? "факт" : kind === "now" ? "сейчас" : "";
  const note = names.join(", ") || (kind === "none" ? "нет отчёта" : kind === "future" ? "ещё не наступил" : "нет выплат");
  return (
    <div key={ym} style={{ "--d": `${i * 40}ms` } as React.CSSProperties} className={cls}>
      <span className="m">
        <span>{MONTHS_SHORT[mo - 1]} {String(y).slice(2)}</span>
        <span>{tag}</span>
      </span>
      <b className="num">{sum ? rub(sum) : "—"}</b>
      <small>{note}</small>
    </div>
  );
}

/** Купонный календарь: только факт из отчётов. Свёрнут на три последних месяца, по кнопке 12 месяцев с листанием по годам. */
export function CouponsBlock({ data, m }: { data: AppData; m: Model }) {
  const [open, setOpen] = useState(false);
  const curYear = Number(m.currentMonth.slice(0, 4));
  const firstYear = data.snapshots[0] ? Number(data.snapshots[0].month.slice(0, 4)) : curYear;
  const [year, setYear] = useState(curYear);
  const firstMonth = data.snapshots[0]?.month ?? null;

  if (!m.hasBonds && !data.coupons.length) {
    return (
      <Section>
        <div className="sec-h"><span className="lbl">Купонный календарь</span></div>
        <p className="sum">Облигаций нет</p>
      </Section>
    );
  }

  const names = (ym: string) => [...new Set(data.coupons.filter((c) => c.date.startsWith(ym)).map((c) => c.name))];
  const kindOf = (ym: string): Kind => (ym > m.currentMonth ? "future" : ym === m.currentMonth ? "now" : firstMonth && ym >= firstMonth ? "past" : "none");
  const card = (ym: string, i: number) => monthCard(ym, kindOf(ym), m.couponMonths.get(ym) ?? 0, names(ym), i);
  const total = [...m.couponMonths.values()].reduce((a, b) => a + b, 0);

  return (
    <Section>
      <div className="sec-h">
        <span className="lbl">Купонный календарь</span>
        <button className="linkbtn" type="button" aria-expanded={open} aria-controls="coupon-box" onClick={() => { setOpen(!open); setYear(curYear); }}>
          {open ? "Свернуть" : "Весь календарь"}
        </button>
      </div>
      <div className="cplw" id="coupon-box">
        {!open ? (
          <div className="cpl">{[2, 1, 0].map((back, i) => card(addMonths(m.currentMonth, -back), i))}</div>
        ) : (
          <>
            <div className="nav" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
              <button type="button" aria-label="Предыдущий год" disabled={year <= firstYear} onClick={() => setYear(year - 1)}><LeftIcon /></button>
              <span>{year}</span>
              <button type="button" aria-label="Следующий год" disabled={year >= curYear + 1} onClick={() => setYear(year + 1)}><RightIcon /></button>
            </div>
            <div className="cpl">{Array.from({ length: 12 }, (_, i) => card(`${year}-${String(i + 1).padStart(2, "0")}`, i))}</div>
          </>
        )}
        <p className="coupons num">Получено купонов по отчётам: {rub(total)}</p>
      </div>
    </Section>
  );
}

export { monthIndex };
