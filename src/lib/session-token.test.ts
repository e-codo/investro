import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { readSession, signSession } from "./session-token";

const secret = "x".repeat(40);
beforeAll(() => {
  process.env.SESSION_SECRET = secret;
});

describe("сессия", () => {
  it("возвращает id пользователя из собственной куки", async () => {
    const id = "3f8a2b1c-9d4e-4f6a-8b7c-1234567890ab";
    const { token } = await signSession(id);
    expect(await readSession(token)).toBe(id);
  });

  it("кука прежней версии (sub = owner) не считается сессией", async () => {
    const old = await new SignJWT({ sub: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(secret));
    expect(await readSession(old)).toBeNull();
  });

  it("мусор и пустое значение", async () => {
    expect(await readSession("abc")).toBeNull();
    expect(await readSession(undefined)).toBeNull();
  });
});
