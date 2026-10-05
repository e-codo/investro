import { z } from "zod";

// Правила ввода, общие для форм (проверка на месте) и серверных действий (настоящая проверка).

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const dateSchema = z.string().refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isRealDate(s), "Неверная дата.");
const kopecksNonNeg = z.number().int().min(0).max(100_000_000_000_00);
const kopecksPositive = z.number().int().min(1).max(100_000_000_000_00);

export const ASSET_TYPES = ["bond", "fund", "stock"] as const;

/** Что экран проверки отправляет на сервер. Сервер заново проверяет всё (раздел 2.1), клиенту не верит. */
export const snapshotInputSchema = z.object({
  source: z.enum(["pdf", "table"]),
  parserVersion: z.string().max(20),
  periodStart: dateSchema,
  periodEnd: dateSchema,
  valueK: kopecksNonNeg,
  cashK: kopecksNonNeg,
  reportDepositK: kopecksNonNeg,
  contributionK: kopecksNonNeg,
  deductionK: kopecksNonNeg,
  withdrawalK: kopecksNonNeg,
  feesK: kopecksNonNeg,
  taxesK: kopecksNonNeg,
  flowDate: dateSchema,
  foreign: z.boolean(),
  sectionTotals: z.object({ bond: kopecksNonNeg.nullable(), fund: kopecksNonNeg.nullable(), stock: kopecksNonNeg.nullable() }),
  positions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        type: z.enum(ASSET_TYPES),
        quantity: z.number().int().min(1).max(1_000_000_000),
        valueK: kopecksNonNeg,
        classId: z.string().uuid().nullable(),
      }),
    )
    .min(1, "В отчёте нет позиций.")
    .max(200),
  coupons: z.array(z.object({ name: z.string().trim().min(1).max(200), date: dateSchema, amountK: kopecksPositive })).max(500),
});
export type SnapshotInput = z.infer<typeof snapshotInputSchema>;

export const BLOCK_IDS = ["title", "value", "goal", "milestones", "calendar", "growth", "coupons", "allocation", "quote"] as const;
export type BlockId = (typeof BLOCK_IDS)[number];

export const settingsInputSchema = z.object({
  title: z.string().max(80),
  subtitle: z.string().max(140),
  quote: z.string().max(240),
  goalK: kopecksPositive,
  depositRate: z.number().min(0).max(100),
  inflation: z.number().min(0).max(100),
  milestonesK: z.array(kopecksPositive).max(30),
  strategyEnabled: z.boolean(),
  strategyName: z.string().max(40).nullable(),
  /** Классы: id существующего класса или «new:…» для добавленного в этой сессии. */
  classes: z
    .array(z.object({ id: z.string().min(1).max(60), name: z.string().trim().min(1, "Название класса не может быть пустым.").max(30), weight: z.number().int().min(0).max(100) }))
    .min(1)
    .max(5),
  /** Куда переносить бумаги удалённых классов: from — удалённый, to — оставшийся (id или «new:…»). */
  transfers: z.array(z.object({ from: z.string(), to: z.string() })).max(20),
  /** Класс каждой бумаги: instrumentId → id класса (или «new:…»). */
  instrumentClasses: z.record(z.string(), z.string()),
  blocks: z.record(z.string(), z.boolean()),
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email("Введите почту в виде name@mail.ru."));

/** Регистрация: правила пароля. */
export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Пароль не короче 8 символов.").max(128, "Пароль не длиннее 128 символов."),
});

/** Вход: правила длины не проверяем, неверный пароль любой длины это обычная неудачная попытка. */
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
