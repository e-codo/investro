import { Dashboard } from "@/components/dashboard/dashboard";
import { getDb } from "@/db";
import { todayEkb } from "@/lib/dates";
import { loadAppData } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await requireUser();
  const data = await loadAppData(getDb(), userId);
  return <Dashboard data={data} today={todayEkb()} />;
}
