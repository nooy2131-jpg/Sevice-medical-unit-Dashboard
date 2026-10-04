import { ReportEditorClient } from "@/src/components/ReportsClient";
import { requireUser } from "@/src/lib/authorization";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const user = await requireUser();
  const { date } = await params;
  return <ReportEditorClient initialDate={date} role={user.role} />;
}
