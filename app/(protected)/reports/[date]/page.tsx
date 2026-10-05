import { ReportEditorClient } from "@/src/components/ReportsClient";
import { requireUser } from "@/src/lib/authorization";
import { isCalendarDate } from "@/src/lib/dates";
import { notFound } from "next/navigation";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const user = await requireUser();
  const { date } = await params;
  if (!isCalendarDate(date)) notFound();
  return <ReportEditorClient initialDate={date} role={user.role} userId={user.id} />;
}
