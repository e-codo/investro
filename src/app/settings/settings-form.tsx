"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAllDataAction, deleteSnapshotAction, saveSettingsAction } from "@/app/actions/data";
import { Logo } from "@/components/logo";
import { useToast } from "@/components/toast";
import { useWait } from "@/components/wait";
import type { AppData } from "@/lib/app-types";
import { MAX_CLASSES } from "@/lib/defaults";
import { monthLabel, rub } from "@/lib/format";
import { parseRublesInput, toInputValue } from "@/lib/money";
import { BLOCK_IDS, type BlockId } from "@/lib/schemas";

const BLOCK_LABELS: Record<BlockId, string> = {
  title: "Заголовок", value: "Стоимость портфеля", goal: "Прогресс к цели", milestones: "Вехи", calendar: "Календарь взносов",
  growth: "Рост портфеля", coupons: "Купонный календарь", allocation: "Аллокация", quote: "Цитата",
};
const TYPE_LABEL = { bond: "облигация", fund: "фонд", stock: "акция" } as const;

type ClassRow = { id: string; name: string; weight: string };
const num = (t: string) => {
  const v = Number(t.replace(/[\s ]/g, "").replace(",", "."));
  return t.trim() === "" || !Number.isFinite(v) ? null : v;
};
const rate = (v: number) => String(v).replace(".", ",");

export function SettingsForm({ data }: { data: AppData }) {
  const s = data.settings;
  const router = useRouter();
  const toast = useToast();
  const { go } = useWait();
  const [title, setTitle] = useState(s.title);
  const [subtitle, setSubtitle] = useState(s.subtitle);
  const [quote, setQuote] = useState(s.quote);
  const [goal, setGoal] = useState(toInputValue(s.goalK).replace(",00", ""));
  const [deposit, setDeposit] = useState(rate(s.depositRate));
  const [inflation, setInflation] = useState(rate(s.inflation));
  const [milestones, setMilestones] = useState<string[]>(data.milestonesK.map((k) => toInputValue(k).replace(",00", "")));
  const [newMilestone, setNewMilestone] = useState("");
  const [strategyOn, setStrategyOn] = useState(s.strategyEnabled);
  const [strategyName, setStrategyName] = useState(s.strategyName ?? "");
  const [classes, setClasses] = useState<ClassRow[]>(data.classes.map((c) => ({ id: c.id, name: c.name, weight: String(c.weight) })));
  const [removed, setRemoved] = useState<string[]>([]);
  const [transfers, setTransfers] = useState<Record<string, string>>({});
  const [instrumentClasses, setInstrumentClasses] = useState<Record<string, string>>({});
  const [blocks, setBlocks] = useState<Record<string, boolean>>(Object.fromEntries(BLOCK_IDS.map((id) => [id, s.blocks[id] !== false])));
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [askSnapshot, setAskSnapshot] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeWord, setWipeWord] = useState("");

  const weights = classes.map((c) => num(c.weight));
  const sum = weights.reduce<number>((a, w) => a + (w ?? 0), 0);
  const errors: string[] = [];
  if (strategyOn && sum !== 100) errors.push("Сумма долей стратегии должна быть 100%.");
  if (weights.some((w) => w == null || !Number.isInteger(w) || w < 0 || w > 100)) errors.push("Доля класса — целое число от 0 до 100.");
  if (classes.some((c) => !c.name.trim())) errors.push("Название класса не может быть пустым.");
  const goalK = parseRublesInput(goal);
  if (goalK == null || goalK <= 0) errors.push("Сумма цели должна быть числом больше нуля.");
  if (num(deposit) == null || num(inflation) == null) errors.push("Ставка вклада и инфляция должны быть числами.");
  const removedUsed = removed.filter((id) => data.instruments.some((i) => i.classId === id));
  for (const id of removedUsed) if (!transfers[id]) errors.push(`Выберите, в какой класс перенести бумаги класса «${data.classes.find((c) => c.id === id)?.name}».`);

  const defaultName = classes.map((c) => c.weight).join(" / ");
  const classOf = (iid: string, fallback: string | null) => instrumentClasses[iid] ?? fallback ?? "";

  function removeClass(id: string) {
    setClasses(classes.filter((c) => c.id !== id));
    if (!id.startsWith("new:")) {
      setRemoved([...removed, id]);
      setTransfers({ ...transfers, [id]: classes.find((c) => c.id !== id)?.id ?? "" });
    }
  }

  async function save() {
    if (errors.length) return;
    setSaving(true);
    setServerError(null);
    const res = await saveSettingsAction({
      title, subtitle, quote, goalK, depositRate: num(deposit), inflation: num(inflation),
      milestonesK: milestones.map((m) => parseRublesInput(m)).filter((k): k is number => k != null && k > 0),
      strategyEnabled: strategyOn, strategyName: strategyName.trim() || null,
      classes: classes.map((c) => ({ id: c.id, name: c.name, weight: num(c.weight) })),
      transfers: removed.filter((id) => transfers[id]).map((id) => ({ from: id, to: transfers[id] })),
      instrumentClasses, blocks,
    });
    setSaving(false);
    if (res.ok) {
      toast("Настройки сохранены");
      go("/");
      router.refresh();
    } else setServerError(res.error);
  }

  async function removeSnapshot(month: string) {
    const res = await deleteSnapshotAction(month);
    setAskSnapshot(null);
    toast(res.ok ? "Снимок удалён" : res.error);
    if (res.ok) router.refresh();
  }

  async function wipe() {
    const res = await deleteAllDataAction();
    setWipeOpen(false);
    setWipeWord("");
    toast(res.ok ? "Все данные удалены" : res.error);
    if (res.ok) router.refresh();
  }

  return (
    <div className="wrap set">
      <header className="top">
        <div className="meta">
          <Logo />
          <span>Настройки</span>
        </div>
      </header>
      <div className="hero"><h1>Настройки</h1></div>

      <section className="sec">
        <div className="sec-h"><span className="lbl">Тексты</span></div>
        <div className="mini">
          <div className="fld"><label htmlFor="s-title">Заголовок</label><input className="inp" id="s-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="fld"><label htmlFor="s-sub">Подзаголовок</label><input className="inp" id="s-sub" value={subtitle} maxLength={140} onChange={(e) => setSubtitle(e.target.value)} /></div>
          <div className="fld"><label htmlFor="s-quote">Цитата</label><textarea className="inp ta" id="s-quote" value={quote} maxLength={240} onChange={(e) => setQuote(e.target.value)} /></div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="lbl">Цель</span></div>
        <div className="mini">
          <div className="fld"><label htmlFor="s-goal">Сумма цели, ₽</label><input className="inp num" id="s-goal" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
          <div className="grid2">
            <div className="fld"><label htmlFor="s-dep">Ставка вклада, % годовых</label><input className="inp num" id="s-dep" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
            <div className="fld"><label htmlFor="s-infl">Инфляция, % годовых</label><input className="inp num" id="s-infl" inputMode="decimal" value={inflation} onChange={(e) => setInflation(e.target.value)} /></div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="lbl">Вехи</span></div>
        <div className="mini">
          {[...milestones].sort((a, b) => (parseRublesInput(a) ?? 0) - (parseRublesInput(b) ?? 0)).map((m) => (
            <div className="rowm" key={m}>
              <div className="inp num" style={{ display: "flex", alignItems: "center" }}>{rub((parseRublesInput(m) ?? 0))}</div>
              <button className="danger" type="button" onClick={() => setMilestones(milestones.filter((x) => x !== m))}>Удалить</button>
            </div>
          ))}
          <div className="rowm">
            <input className="inp num" aria-label="Новая веха, ₽" inputMode="numeric" placeholder="Новая веха, ₽" value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} />
            <button className="btn sm" type="button" onClick={() => { const k = parseRublesInput(newMilestone); if (k && k > 0 && !milestones.includes(newMilestone.trim())) { setMilestones([...milestones, toInputValue(k).replace(",00", "")]); setNewMilestone(""); } }}>Добавить</button>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="lbl">Стратегия</span></div>
        <div className="mini">
          <label className="tgl"><input type="checkbox" checked={strategyOn} onChange={(e) => setStrategyOn(e.target.checked)} /><span>Использовать стратегию и блок «Аллокация»</span></label>
          {classes.map((c, i) => (
            <div className="rowx" key={c.id}>
              <input className="inp" aria-label="Название класса" value={c.name} maxLength={30} onChange={(e) => setClasses(classes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="inp num" aria-label="Доля, %" inputMode="numeric" value={c.weight} onChange={(e) => setClasses(classes.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
              <button className="danger" type="button" disabled={classes.length <= 1} onClick={() => removeClass(c.id)}>Удалить</button>
            </div>
          ))}
          {removedUsed.map((id) => (
            <div className="fld" key={id}>
              <label htmlFor={`tr-${id}`}>Бумаги класса «{data.classes.find((c) => c.id === id)?.name}» перенести в</label>
              <select className="inp sm" id={`tr-${id}`} value={transfers[id] ?? ""} onChange={(e) => setTransfers({ ...transfers, [id]: e.target.value })}>
                <option value="">Выберите класс</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name || "Без названия"}</option>)}
              </select>
            </div>
          ))}
          <div className="sum">Сумма долей: <b className="num">{sum}%</b></div>
          <button className="linkbtn" type="button" disabled={classes.length >= MAX_CLASSES} onClick={() => setClasses([...classes, { id: `new:${Date.now()}`, name: "Новый класс", weight: "0" }])}>Добавить класс (до {MAX_CLASSES})</button>
          <div className="fld"><label htmlFor="s-sname">Имя стратегии</label><input className="inp" id="s-sname" maxLength={40} placeholder={defaultName} value={strategyName} onChange={(e) => setStrategyName(e.target.value)} /></div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="lbl">Бумаги</span></div>
        <div className="mini">
          {data.instruments.length === 0 && <div className="ok">Бумаг пока нет</div>}
          {data.instruments.map((i) => (
            <div className="rowm" key={i.id}>
              <div style={{ minWidth: 0 }}>
                <div style={{ overflowWrap: "anywhere" }}>{i.name}</div>
                <div className="hint">{TYPE_LABEL[i.type]}</div>
              </div>
              <select className="inp sm" aria-label={`Класс: ${i.name}`} style={{ width: "auto", maxWidth: 150 }} value={classOf(i.id, i.classId)} onChange={(e) => setInstrumentClasses({ ...instrumentClasses, [i.id]: e.target.value })}>
                {!classOf(i.id, i.classId) && <option value="">Без класса</option>}
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name || "Без названия"}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="lbl">Блоки главного экрана</span></div>
        <div className="mini">
          {BLOCK_IDS.map((id, i) => (
            <label className="tgl" key={id}><input type="checkbox" checked={blocks[id]} onChange={(e) => setBlocks({ ...blocks, [id]: e.target.checked })} /><span>{i + 1}. {BLOCK_LABELS[id]}</span></label>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="lbl">Данные</span></div>
        <div className="mini">
          {[...data.snapshots].reverse().map((x) => (
            <div key={x.id}>
              <div className="rowm">
                <span className="num">{monthLabel(x.month)} · {rub(x.valueK)}</span>
                <button className="danger" type="button" onClick={() => setAskSnapshot(askSnapshot === x.month ? null : x.month)}>Удалить</button>
              </div>
              {askSnapshot === x.month && (
                <div className="acts" style={{ marginTop: 8 }}>
                  <span className="note">Удалить снимок за {monthLabel(x.month)}?</span>
                  <button className="btn sm fill" type="button" onClick={() => void removeSnapshot(x.month)}>Да, удалить</button>
                  <button className="btn sm ghost" type="button" onClick={() => setAskSnapshot(null)}>Отмена</button>
                </div>
              )}
            </div>
          ))}
          <a className="linkbtn" href="/template-report.xlsx" download>Скачать шаблон таблицы (.xlsx)</a>
          <button className="linkbtn" type="button" onClick={() => setWipeOpen(!wipeOpen)}>Удалить все данные</button>
          {wipeOpen && (
            <div className="grp">
              <div className="fld"><label htmlFor="s-word">Введите слово «удалить»</label><input className="inp" id="s-word" autoComplete="off" value={wipeWord} onChange={(e) => setWipeWord(e.target.value)} /></div>
              <button className="btn sm" type="button" disabled={wipeWord.trim().toLowerCase() !== "удалить"} onClick={() => void wipe()}>Удалить все данные</button>
            </div>
          )}
        </div>
      </section>

      <div className="savebar">
        <div>
          {(errors[0] || serverError) && <div className="err" role="alert">{serverError ?? errors[0]}</div>}
          <button className="btn ghost" type="button" onClick={() => go("/")}>Отмена</button>
          <button className="btn fill" type="button" disabled={saving || errors.length > 0} onClick={() => void save()}>{saving ? "Сохраняю…" : "Сохранить"}</button>
        </div>
      </div>
    </div>
  );
}
