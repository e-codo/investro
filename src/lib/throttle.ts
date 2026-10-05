import { and, eq, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, tables } from "@/db";

// Ограничения против перебора пароля и массовой регистрации.
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MINUTES = 15;
export const REGISTER_MAX = 5;
export const REGISTER_WINDOW_MINUTES = 60;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

async function count(kind: string, subject: string, minutes: number): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.authAttempts)
    .where(
      and(
        eq(tables.authAttempts.kind, kind),
        eq(tables.authAttempts.subject, subject),
        sql`${tables.authAttempts.at} > now() - make_interval(mins => ${minutes})`,
      ),
    );
  return row?.n ?? 0;
}

async function record(kind: string, subject: string): Promise<void> {
  const db = getDb();
  await db.insert(tables.authAttempts).values({ kind, subject });
  // Старые записи не нужны: чистим попутно.
  await db.delete(tables.authAttempts).where(lt(tables.authAttempts.at, sql`now() - interval '1 day'`));
}

/** Вход заблокирован, если с этого адреса или для этой почты было слишком много неудач. */
export async function loginLocked(ip: string, email: string): Promise<boolean> {
  const [byIp, byEmail] = await Promise.all([
    count("login", `ip:${ip}`, LOGIN_WINDOW_MINUTES),
    count("login", `email:${email}`, LOGIN_WINDOW_MINUTES),
  ]);
  return byIp >= LOGIN_MAX_FAILURES || byEmail >= LOGIN_MAX_FAILURES;
}

export async function recordLoginFailure(ip: string, email: string): Promise<void> {
  await record("login", `ip:${ip}`);
  await record("login", `email:${email}`);
}

/** После успешного входа сбрасываем только счётчик почты: счётчик адреса не сбрасываем, иначе его можно обнулять входом в свой аккаунт. */
export async function clearEmailFailures(email: string): Promise<void> {
  await getDb()
    .delete(tables.authAttempts)
    .where(and(eq(tables.authAttempts.kind, "login"), eq(tables.authAttempts.subject, `email:${email}`)));
}

export async function registerLocked(ip: string): Promise<boolean> {
  return (await count("register", `ip:${ip}`, REGISTER_WINDOW_MINUTES)) >= REGISTER_MAX;
}

export async function recordRegistration(ip: string): Promise<void> {
  await record("register", `ip:${ip}`);
}
