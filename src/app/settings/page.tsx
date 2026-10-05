import { getDb } from "@/db";
import { loadAppData } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUser();
  const data = await loadAppData(getDb(), userId);
  return <SettingsForm data={data} />;
}
