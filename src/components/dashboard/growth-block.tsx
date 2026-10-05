"use client";

import { useEffect, useRef, useState } from "react";
import { LeftIcon, RightIcon } from "@/components/icons";
import { Section } from "@/components/reveal";
import type { SnapshotDTO } from "@/lib/app-types";
import { ownContribution } from "@/lib/portfolio";
import { MONTHS_SHORT, dmy, monthLabel, rub } from "@/lib/format";
import { toSnap } from "./model";

const MAX_BARS = 12;

/** Столбцы по месяцам: вложено своих (серый) и стоимость (чёрный); верх чёрного равен прибыли и закрашен акцентным («шапка»). */
export function GrowthBlock({ snapshots }: { snapshots: SnapshotDTO[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const own: number[] = [];
  let acc = 0;
  for (const s of snapshots) {
    acc += ownContribution(toSnap(s)) - s.withdrawalK;
    own.push(acc);
  }
  const n = snapshots.length;
  const visible = Math.min(MAX_BARS, n);
  const start = Math.max(0, n - visible - offset);
  const part = snapshots.slice(start, start + visible);
  const H = width < 480 ? 220 : 280;
  const top = 28;
  const bottom = 26;
  const max = Math.max(...part.map((s) => s.valueK)) * 1.04;
  const group = (width - 4) / part.length;
  const bar = Math.min(48, group * 0.34);
  const scale = (H - top - bottom) / max;
  const active = Math.min(picked ?? part.length - 1, part.length - 1);
  const cur = part[active];
  const curOwn = own[start + active];
  const base = H - bottom;

  return (
    <Section>
      <div className="sec-h">
        <span className="lbl">Рост портфеля</span>
      </div>
      <div className="legend" style={{ marginBottom: 14 }}>
        <span><i style={{ background: "var(--mid)" }} />Вложено своих</span>
        <span><i style={{ background: "var(--ink)" }} />Стоимость</span>
        <span><i style={{ background: "var(--accent)" }} />Прибыль (шапка столбца)</span>
      </div>
      <div className="readout">
        <span className="d">{monthLabel(cur.month)}, снимок на {dmy(cur.periodEnd)}</span>
        <div>Вложено своих<b className="num">{rub(curOwn)}</b></div>
        <div>Стоимость<b className="num">{rub(cur.valueK)}</b></div>
        <div>Прибыль<b className="num">{rub(cur.valueK - curOwn, { sign: true })}</b></div>
      </div>
      <div ref={box}>
        <div className="nav" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
          <button type="button" aria-label="Раньше" disabled={start === 0} onClick={() => { setOffset(offset + 1); setPicked(null); }}><LeftIcon /></button>
          <span>{MONTHS_SHORT[Number(part[0].month.slice(5)) - 1]} – {MONTHS_SHORT[Number(part.at(-1)!.month.slice(5)) - 1]} {part.at(-1)!.month.slice(0, 4)}</span>
          <button type="button" aria-label="Позже" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 1)); setPicked(null); }}><RightIcon /></button>
        </div>
        <svg className="chart" viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Рост портфеля по месяцам">
          {[1, 2, 3].map((g) => {
            const y = base - ((H - top - bottom) * g) / 3;
            return <line key={g} x1={0} x2={width} y1={y} y2={y} stroke="rgba(34,34,34,.1)" />;
          })}
          {part.map((s, i) => {
            const o = own[start + i];
            const cx = 2 + group * i + group / 2;
            const hv = s.valueK * scale;
            const ho = o * scale;
            const cap = s.valueK > o ? Math.min(hv, Math.max(3, (s.valueK - o) * scale)) : 0;
            const delay = i * 70;
            return (
              <g key={s.id} tabIndex={0} style={{ cursor: "pointer" }} onPointerEnter={() => setPicked(i)} onClick={() => setPicked(i)} onFocus={() => setPicked(i)}>
                <rect x={cx - group / 2} y={0} width={group} height={H} fill="transparent" />
                <rect className="bar-grow" style={{ "--d": `${delay}ms` } as React.CSSProperties} x={cx - bar - 1} y={base - ho} width={bar} height={ho} rx={3} fill="#B3ADA1" />
                <g className="bar-grow" style={{ "--d": `${delay + 40}ms` } as React.CSSProperties}>
                  <clipPath id={`bar-${s.id}`}>
                    <rect x={cx + 1} y={base - hv} width={bar} height={hv} rx={3} />
                  </clipPath>
                  <rect x={cx + 1} y={base - hv} width={bar} height={hv} rx={3} fill="#222222" />
                  {cap > 0 && <rect clipPath={`url(#bar-${s.id})`} x={cx + 1} y={base - hv} width={bar} height={cap} fill="#E06238" />}
                </g>
                <text className="bar-fade" style={{ "--d": `${delay + 500}ms` } as React.CSSProperties} x={cx} y={base - Math.max(hv, ho) - 8} fontSize={11} textAnchor="middle">
                  {rub(s.valueK - o, { sign: true })}
                </text>
                <text x={cx} y={H - 8} fontSize={11} textAnchor="middle">{MONTHS_SHORT[Number(s.month.slice(5)) - 1]}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </Section>
  );
}
