import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession, signSession } from "./session-token";

export async function createSession(userId: string) {
  const { token, expires } = await signSession(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Для страниц и действий: id текущего пользователя. Все запросы к данным обязаны
 * фильтровать по нему, так пользователи не видят чужое. Без сессии отправляет на вход.
 */
export async function requireUser(): Promise<string> {
  const store = await cookies();
  const userId = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!userId) redirect("/login");
  return userId;
}
