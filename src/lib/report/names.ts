import type { AssetType } from "./types";

/** Ключ бумаги: без лишних пробелов, «ё» = «е», регистр не важен. */
export const nameKey = (name: string) => name.replace(/\s+/g, " ").trim().replace(/ё/g, "е").replace(/Ё/g, "Е").toLowerCase();

export const cleanName = (name: string) => name.replace(/\s+/g, " ").trim();

/** Роль класса по умолчанию: название класса, которое ожидаем у бумаги. null, если выбирает пользователь. */
export function defaultRole(name: string, type: AssetType): string | null {
  if (type === "bond") return "облигации";
  if (type === "fund") {
    const k = nameKey(name);
    if (k.includes("ликвидность")) return "ликвидность";
    if (k.includes("индекс")) return "акции";
  }
  return null;
}

/** Класс по умолчанию среди классов пользователя (по названию), либо null. */
export function defaultClassId(name: string, type: AssetType, classes: { id: string; name: string }[]): string | null {
  const role = defaultRole(name, type);
  if (!role) return null;
  return classes.find((c) => nameKey(c.name) === role)?.id ?? null;
}
