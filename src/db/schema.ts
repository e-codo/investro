import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, numeric, pgTable, serial, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// Деньги хранятся целыми копейками (bigint, mode number: до 90 трлн ₽ влезает в Number).
const kopecks = (name: string) => bigint(name, { mode: "number" });

/** Пользователь. Пароль только в виде хэша с солью (см. src/lib/password.ts). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("users_email_unique").on(t.email)],
);

/** Настройки пользователя: одна строка на человека. */
export const settings = pgTable(
  "settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    quote: text("quote").notNull(),
    goalKopecks: kopecks("goal_kopecks").notNull(),
    /** Ставка вклада и инфляция, % годовых. Для сравнения доходности. */
    depositRate: numeric("deposit_rate", { precision: 5, scale: 2 }).notNull().default("14"),
    inflation: numeric("inflation", { precision: 5, scale: 2 }).notNull().default("6.5"),
    strategyEnabled: boolean("strategy_enabled").notNull().default(true),
    /** null: имя собирается из долей само. */
    strategyName: text("strategy_name"),
    /** Видимость блоков главного экрана: id блока → вкл/выкл. Нет ключа = включён. */
    blocks: jsonb("blocks").$type<Record<string, boolean>>().notNull().default({}),
  },
  (t) => [check("settings_goal_positive", sql`${t.goalKopecks} > 0`)],
);

export const milestones = pgTable(
  "milestones",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountKopecks: kopecks("amount_kopecks").notNull(),
  },
  (t) => [index("milestones_user_idx").on(t.userId), check("milestones_positive", sql`${t.amountKopecks} > 0`)],
);

/** Классы стратегии: до 5 на пользователя (проверяет приложение), сумма долей 100. */
export const assetClasses = pgTable(
  "asset_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    weight: smallint("weight").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [index("asset_classes_user_idx").on(t.userId), check("asset_classes_weight_range", sql`${t.weight} between 0 and 100`)],
);

/** Бумага из отчётов и её класс. Опознаётся по нормализованному названию (name_key). */
export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    /** bond | fund | stock */
    type: text("type").notNull(),
    classId: uuid("class_id").references(() => assetClasses.id, { onDelete: "set null" }),
  },
  (t) => [unique("instruments_user_key_unique").on(t.userId, t.nameKey), index("instruments_user_idx").on(t.userId)],
);

/** Один снимок на месяц: данные месячного отчёта. */
export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** ГГГГ-ММ. */
    month: text("month").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    /** Конец периода: он же дата снимка. */
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    valueKopecks: kopecks("value_kopecks").notNull(),
    cashKopecks: kopecks("cash_kopecks").notNull(),
    /** Пополнения по отчёту. */
    reportDepositKopecks: kopecks("report_deposit_kopecks").notNull(),
    /** Взнос месяца: по умолчанию равен пополнениям, правится вручную. */
    contributionKopecks: kopecks("contribution_kopecks").notNull(),
    deductionKopecks: kopecks("deduction_kopecks").notNull().default(0),
    withdrawalKopecks: kopecks("withdrawal_kopecks").notNull().default(0),
    feesKopecks: kopecks("fees_kopecks").notNull().default(0),
    taxesKopecks: kopecks("taxes_kopecks").notNull().default(0),
    /** Дата взноса для XIRR. */
    flowDate: date("flow_date", { mode: "string" }).notNull(),
    /** pdf | table */
    source: text("source").notNull(),
    parserVersion: text("parser_version").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("snapshots_user_month_unique").on(t.userId, t.month), check("snapshots_amounts_nonneg", sql`${t.contributionKopecks} >= 0 and ${t.deductionKopecks} >= 0 and ${t.withdrawalKopecks} >= 0`)],
);

export const positions = pgTable(
  "positions",
  {
    id: serial("id").primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    valueKopecks: kopecks("value_kopecks").notNull(),
  },
  (t) => [index("positions_snapshot_idx").on(t.snapshotId)],
);

/** Полученные купоны. Дубли из повторных загрузок отсекаются уникальностью. */
export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    amountKopecks: kopecks("amount_kopecks").notNull(),
  },
  (t) => [unique("coupons_unique").on(t.userId, t.instrumentId, t.date, t.amountKopecks), index("coupons_user_idx").on(t.userId)],
);

/** Неудачные попытки входа и регистрации для ограничения перебора. */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: serial("id").primaryKey(),
    /** "login" или "register". */
    kind: text("kind").notNull(),
    /** Адрес клиента или почта: ограничение считается по обоим. */
    subject: text("subject").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_attempts_lookup_idx").on(t.kind, t.subject, t.at)],
);
