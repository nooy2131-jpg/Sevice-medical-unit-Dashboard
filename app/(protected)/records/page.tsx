import { ReportsRecordsClient } from "@/src/components/ReportsClient";
import { requireUser } from "@/src/lib/authorization";

export default async function RecordsPage() {
  const user = await requireUser();
  return <ReportsRecordsClient role={user.role} />;
}
