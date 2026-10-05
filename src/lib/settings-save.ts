import { and, eq, inArray } from "drizzle-orm";
import { tables } from "@/db";
import type { ActionResult } from "./app-types";
import type { Db } from "./queries";
import { MAX_CLASSES } from "./defaults";
import { BLOCK_IDS, settingsInputSchema } from "./schemas";

/** Сохранение настроек одной транзакцией: классы, переносы бумаг, вехи, блоки. */
export async function saveSettings(db: Db, userId: string, raw: unknown): Promise<ActionResult> {
  const parsed = settingsInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Настройки неверны." };
  const s = parsed.data;
  if (s.classes.length > MAX_CLASSES) return { ok: false, error: `Классов не больше ${MAX_CLASSES}.` };
  const sum = s.classes.reduce((a, c) => a + c.weight, 0);
  if (s.strategyEnabled && sum !== 100) return { ok: false, error: "Сумма долей классов должна быть ровно 100%." };

  const [oldClasses, instruments] = await Promise.all([
    db.select().from(tables.assetClasses).where(eq(tables.assetClasses.userId, userId)),
    db.select().from(tables.instruments).where(eq(tables.instruments.userId, userId)),
  ]);
  const oldIds = new Set(oldClasses.map((c) => c.id));
  const kept = s.classes.filter((c) => oldIds.has(c.id));
  const removed = oldClasses.filter((c) => !kept.some((k) => k.id === c.id));
  const newOnes = s.classes.filter((c) => c.id.startsWith("new:"));
  if (kept.length + newOnes.length !== s.classes.length) return { ok: false, error: "Выбран неизвестный класс." };
  const transferTo = new Map(s.transfers.map((t) => [t.from, t.to]));
  for (const r of removed) {
    const used = instruments.some((i) => i.classId === r.id);
    if (used && !s.classes.some((c) => c.id === transferTo.get(r.id))) return { ok: false, error: `Выберите, в какой класс перенести бумаги класса «${r.name}».` };
  }
  const instrumentIds = new Set(instruments.map((i) => i.id));
  for (const [iid, cid] of Object.entries(s.instrumentClasses)) {
    if (!instrumentIds.has(iid)) return { ok: false, error: "Неизвестная бумага." };
    if (!s.classes.some((c) => c.id === cid)) return { ok: false, error: "Бумаге назначен неизвестный класс." };
  }

  await db.transaction(async (tx) => {
    const idOf = new Map<string, string>();
    for (const [position, c] of s.classes.entries()) {
      if (oldIds.has(c.id)) {
        await tx.update(tables.assetClasses).set({ name: c.name, weight: c.weight, position }).where(and(eq(tables.assetClasses.id, c.id), eq(tables.assetClasses.userId, userId)));
        idOf.set(c.id, c.id);
      } else {
        const [row] = await tx.insert(tables.assetClasses).values({ userId, name: c.name, weight: c.weight, position }).returning({ id: tables.assetClasses.id });
        idOf.set(c.id, row.id);
      }
    }
    for (const r of removed) {
      const to = transferTo.get(r.id);
      if (to) await tx.update(tables.instruments).set({ classId: idOf.get(to)! }).where(and(eq(tables.instruments.userId, userId), eq(tables.instruments.classId, r.id)));
    }
    for (const [iid, cid] of Object.entries(s.instrumentClasses)) {
      await tx.update(tables.instruments).set({ classId: idOf.get(cid)! }).where(and(eq(tables.instruments.id, iid), eq(tables.instruments.userId, userId)));
    }
    if (removed.length) await tx.delete(tables.assetClasses).where(and(eq(tables.assetClasses.userId, userId), inArray(tables.assetClasses.id, removed.map((r) => r.id))));
    await tx.delete(tables.milestones).where(eq(tables.milestones.userId, userId));
    const ms = [...new Set(s.milestonesK)].sort((a, b) => a - b);
    if (ms.length) await tx.insert(tables.milestones).values(ms.map((m) => ({ userId, amountKopecks: m })));
    const blocks: Record<string, boolean> = {};
    for (const id of BLOCK_IDS) if (id in s.blocks) blocks[id] = s.blocks[id];
    await tx
      .update(tables.settings)
      .set({
        title: s.title,
        subtitle: s.subtitle,
        quote: s.quote,
        goalKopecks: s.goalK,
        depositRate: String(s.depositRate),
        inflation: String(s.inflation),
        strategyEnabled: s.strategyEnabled,
        strategyName: s.strategyName && s.strategyName.trim() ? s.strategyName.trim() : null,
        blocks,
      })
      .where(eq(tables.settings.userId, userId));
  });
  return { ok: true };
}
