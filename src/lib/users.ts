import { tables } from "@/db";
import type { Db } from "./queries";
import { DEFAULT_CLASSES, DEFAULT_DEPOSIT_RATE, DEFAULT_GOAL_RUB, DEFAULT_INFLATION, DEFAULT_MILESTONES_RUB, DEFAULT_TEXTS } from "./defaults";

/** Пользователь с настройками по умолчанию, классами стратегии и вехами: одной транзакцией. */
export async function createUserWithDefaults(db: Db, email: string, passwordHash: string): Promise<string> {
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(tables.users).values({ email, passwordHash }).returning({ id: tables.users.id });
    await tx.insert(tables.settings).values({
      userId: user.id,
      title: DEFAULT_TEXTS.title,
      subtitle: DEFAULT_TEXTS.subtitle,
      quote: DEFAULT_TEXTS.quote,
      goalKopecks: DEFAULT_GOAL_RUB * 100,
      depositRate: String(DEFAULT_DEPOSIT_RATE),
      inflation: String(DEFAULT_INFLATION),
      strategyEnabled: true,
      strategyName: null,
      blocks: {},
    });
    await tx.insert(tables.assetClasses).values(DEFAULT_CLASSES.map((c, i) => ({ userId: user.id, name: c.name, weight: c.weight, position: i })));
    await tx.insert(tables.milestones).values(DEFAULT_MILESTONES_RUB.map((m) => ({ userId: user.id, amountKopecks: m * 100 })));
    return user.id;
  });
}
