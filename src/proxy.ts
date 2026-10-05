import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "./lib/session-token";

// Первая линия защиты: без действующей сессии пускаем только на /login.
// Страницы и действия дополнительно проверяют сессию сами (requireUser).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = (await readSession(request.cookies.get(SESSION_COOKIE)?.value)) !== null;

  if (pathname === "/login") {
    return authed ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!authed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
