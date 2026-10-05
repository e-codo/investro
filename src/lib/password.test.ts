import { describe, expect, it } from "vitest";
import { dummyHash, hashPassword, verifyPassword } from "./password";

describe("пароли: scrypt с солью", () => {
  it("верный пароль проходит, неверный нет", async () => {
    const h = await hashPassword("правильный-пароль-123");
    expect(h.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("правильный-пароль-123", h)).toBe(true);
    expect(await verifyPassword("другой-пароль", h)).toBe(false);
  });
  it("соль уникальна: два хэша одного пароля различаются", async () => {
    expect(await hashPassword("одинаковый")).not.toBe(await hashPassword("одинаковый"));
  });
  it("повреждённый хэш не пускает", async () => {
    expect(await verifyPassword("x", "мусор")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$a$b")).toBe(false);
  });
  it("хэш-пустышка существует и не подходит ни к чему", async () => {
    expect(await verifyPassword("любой", await dummyHash())).toBe(false);
  });
});
