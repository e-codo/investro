import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, tables } from "@/db";
import type { AppData } from "./app-types";
import type { AssetType } from "./report/types";

export type Db = ReturnType<typeof getDb>;

/** Всё состояние пользователя для главного экрана и настроек. Все запросы фильтруются по userId. */
export async function loadAppData(db: Db, userId: string): Promise<AppData> {
  const [s] = await db.select().from(tables.settings).where(eq(tables.settings.userId, userId));
  if (!s) throw new Error("У пользователя нет настроек.");
  const [milestones, classes, instruments, snaps, coupons] = await Promise.all([
    db.select().from(tables.milestones).where(eq(tables.milestones.userId, userId)).orderBy(asc(tables.milestones.amountKopecks)),
    db.select().from(tables.assetClasses).where(eq(tables.assetClasses.userId, userId)).orderBy(asc(tables.assetClasses.position)),
    db.select().from(tables.instruments).where(eq(tables.instruments.userId, userId)).orderBy(asc(tables.instruments.name)),
    db.select().from(tables.snapshots).where(eq(tables.snapshots.userId, userId)).orderBy(asc(tables.snapshots.month)),
    db.select().from(tables.coupons).where(eq(tables.coupons.userId, userId)).orderBy(asc(tables.coupons.date)),
  ]);
  const byInstrument = new Map(instruments.map((i) => [i.id, i]));
  const snapIds = snaps.map((x) => x.id);
  const posRows = snapIds.length
    ? await db.select().from(tables.positions).where(inArray(tables.positions.snapshotId, snapIds)).orderBy(asc(tables.positions.id))
    : [];
  return {
    settings: {
      title: s.title,
      subtitle: s.subtitle,
      quote: s.quote,
      goalK: s.goalKopecks,
      depositRate: Number(s.depositRate),
      inflation: Number(s.inflation),
      strategyEnabled: s.strategyEnabled,
      strategyName: s.strategyName,
      blocks: s.blocks ?? {},
    },
    milestonesK: milestones.map((m) => m.amountKopecks),
    classes: classes.map((c) => ({ id: c.id, name: c.name, weight: c.weight })),
    instruments: instruments.map((i) => ({ id: i.id, name: i.name, type: i.type as AssetType, classId: i.classId })),
    snapshots: snaps.map((x) => ({
      id: x.id,
      month: x.month,
      periodStart: x.periodStart,
      periodEnd: x.periodEnd,
      valueK: x.valueKopecks,
      cashK: x.cashKopecks,
      contributionK: x.contributionKopecks,
      deductionK: x.deductionKopecks,
      withdrawalK: x.withdrawalKopecks,
      feesK: x.feesKopecks,
      taxesK: x.taxesKopecks,
      flowDate: x.flowDate,
      positions: posRows
        .filter((p) => p.snapshotId === x.id)
        .map((p) => {
          const i = byInstrument.get(p.instrumentId)!;
          return { instrumentId: i.id, name: i.name, type: i.type as AssetType, classId: i.classId, quantity: p.quantity, valueK: p.valueKopecks };
        }),
    })),
    coupons: coupons.map((c) => ({ name: byInstrument.get(c.instrumentId)?.name ?? "—", date: c.date, amountK: c.amountKopecks })),
  };
}

export { and };
