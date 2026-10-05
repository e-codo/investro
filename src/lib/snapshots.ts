import { and, eq, sql } from "drizzle-orm";
import { tables } from "@/db";
import type { ActionResult } from "./app-types";
import type { Db } from "./queries";
import { nameKey, cleanName } from "./report/names";
import { checkDraft } from "./report/validate";
import { snapshotInputSchema, type SnapshotInput } from "./schemas";
import { monthOf } from "./dates";

/** Сохранение снимка месяца. Сервер заново проверяет всё из раздела 2.1 и не верит экрану проверки. */
export async function saveSnapshot(db: Db, userId: string, raw: unknown): Promise<ActionResult> {
  const parsed = snapshotInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Данные отчёта неверны." };
  const input: SnapshotInput = parsed.data;

  const [classes, existing] = await Promise.all([
    db.select({ id: tables.assetClasses.id }).from(tables.assetClasses).where(eq(tables.assetClasses.userId, userId)),
    db.select({ month: tables.snapshots.month, periodEnd: tables.snapshots.periodEnd }).from(tables.snapshots).where(eq(tables.snapshots.userId, userId)),
  ]);

  const check = checkDraft({ ...input }, existing);
  if (check.errors.length) return { ok: false, error: check.errors[0] };
  const month = check.month!;
  if (input.flowDate < input.periodStart || input.flowDate > input.periodEnd) return { ok: false, error: "Дата взноса должна лежать в периоде отчёта." };

  const classIds = new Set(classes.map((c) => c.id));
  for (const p of input.positions) {
    if (!p.classId) return { ok: false, error: `Выберите класс для бумаги «${cleanName(p.name)}».` };
    if (!classIds.has(p.classId)) return { ok: false, error: "Выбран неизвестный класс." };
  }
  const names = new Set<string>();
  for (const p of input.positions) {
    const k = nameKey(p.name);
    if (names.has(k)) return { ok: false, error: `Бумага «${cleanName(p.name)}» повторяется в отчёте.` };
    names.add(k);
  }

  await db.transaction(async (tx) => {
    const instrumentId = new Map<string, string>();
    const upsertInstrument = async (name: string, type: string, classId: string | null) => {
      const key = nameKey(name);
      if (instrumentId.has(key)) return instrumentId.get(key)!;
      const [row] = await tx
        .insert(tables.instruments)
        .values({ userId, name: cleanName(name), nameKey: key, type, classId })
        .onConflictDoUpdate({
          target: [tables.instruments.userId, tables.instruments.nameKey],
          // Класс запоминается из экрана проверки; у бумаги без выбора (купон) прежний класс не трогаем.
          set: classId ? { classId, type, name: cleanName(name) } : { name: cleanName(name) },
        })
        .returning({ id: tables.instruments.id });
      instrumentId.set(key, row.id);
      return row.id;
    };
    for (const p of input.positions) await upsertInstrument(p.name, p.type, p.classId);

    const values = {
      userId,
      month,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      valueKopecks: input.valueK,
      cashKopecks: input.cashK,
      reportDepositKopecks: input.reportDepositK,
      contributionKopecks: input.contributionK,
      deductionKopecks: input.deductionK,
      withdrawalKopecks: input.withdrawalK,
      feesKopecks: input.feesK,
      taxesKopecks: input.taxesK,
      flowDate: input.flowDate,
      source: input.source,
      parserVersion: input.parserVersion,
      uploadedAt: sql`now()`,
    };
    const [snap] = await tx
      .insert(tables.snapshots)
      .values(values)
      .onConflictDoUpdate({ target: [tables.snapshots.userId, tables.snapshots.month], set: values })
      .returning({ id: tables.snapshots.id });
    await tx.delete(tables.positions).where(eq(tables.positions.snapshotId, snap.id));
    await tx.insert(tables.positions).values(
      input.positions.map((p) => ({ snapshotId: snap.id, instrumentId: instrumentId.get(nameKey(p.name))!, quantity: p.quantity, valueKopecks: p.valueK })),
    );
    for (const c of input.coupons) {
      const id = await upsertInstrument(c.name, "bond", null);
      await tx.insert(tables.coupons).values({ userId, instrumentId: id, date: c.date, amountKopecks: c.amountK }).onConflictDoNothing();
    }
  });
  return { ok: true };
}

/** Удаление снимка месяца. Купоны остаются: это факты выплат. */
export async function deleteSnapshot(db: Db, userId: string, month: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Неверный месяц." };
  const res = await db.delete(tables.snapshots).where(and(eq(tables.snapshots.userId, userId), eq(tables.snapshots.month, month))).returning({ id: tables.snapshots.id });
  return res.length ? { ok: true } : { ok: false, error: "Снимка за этот месяц нет." };
}

/** Удаляет снимки, позиции, купоны и привязки бумаг. Настройки остаются. */
export async function deleteAllData(db: Db, userId: string): Promise<ActionResult> {
  await db.transaction(async (tx) => {
    await tx.delete(tables.coupons).where(eq(tables.coupons.userId, userId));
    await tx.delete(tables.snapshots).where(eq(tables.snapshots.userId, userId));
    await tx.delete(tables.instruments).where(eq(tables.instruments.userId, userId));
  });
  return { ok: true };
}

export { monthOf };
