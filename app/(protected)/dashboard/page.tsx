import { ReportsDashboardClient } from "@/src/components/ReportsClient";
import { requireUser } from "@/src/lib/authorization";

function todayBangkok(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export default async function DashboardPage() {
  await requireUser();
  return <ReportsDashboardClient initialDate={todayBangkok()} />;
}
