"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import type { ActionResult } from "@/lib/app-types";
import { requireUser } from "@/lib/session";
import { saveSettings } from "@/lib/settings-save";
import { deleteAllData, deleteSnapshot, saveSnapshot } from "@/lib/snapshots";

const UNAVAILABLE = "Сервис временно недоступен. Попробуйте позже.";

async function run(fn: (userId: string) => Promise<ActionResult>): Promise<ActionResult> {
  const userId = await requireUser();
  try {
    const result = await fn(userId);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    console.error("action failed", error);
    return { ok: false, error: UNAVAILABLE };
  }
}

export async function saveSnapshotAction(input: unknown): Promise<ActionResult> {
  return run((u) => saveSnapshot(getDb(), u, input));
}
export async function deleteSnapshotAction(month: string): Promise<ActionResult> {
  return run((u) => deleteSnapshot(getDb(), u, month));
}
export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  return run((u) => saveSettings(getDb(), u, input));
}
export async function deleteAllDataAction(): Promise<ActionResult> {
  return run((u) => deleteAllData(getDb(), u));
}
