import { ReportsDashboardClient } from '@/src/components/ReportsClient';
import { requireUser } from '@/src/lib/authorization';
import { todayBangkok } from '@/src/lib/dates';

export default async function DashboardPage() {
  const user = await requireUser();
  return <ReportsDashboardClient initialDate={todayBangkok()} role={user.role} />;
}
