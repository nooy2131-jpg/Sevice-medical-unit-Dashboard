import { DailyReport, normalizeTopItems } from "../types/report";

export type RankedDashboardItem = {
  name: string;
  count: number;
  male: number;
  female: number;
};

export function aggregateRankedItems(
  reports: readonly DailyReport[],
  field: "topDiseases" | "topProcedures",
): RankedDashboardItem[] {
  const totals = new Map<string, RankedDashboardItem>();
  for (const report of reports) {
    for (const item of normalizeTopItems(report[field])) {
      const previous = totals.get(item.name) ?? { name: item.name, count: 0, male: 0, female: 0 };
      totals.set(item.name, {
        name: item.name,
        count: previous.count + item.count,
        male: previous.male + (item.male ?? 0),
        female: previous.female + (item.female ?? 0),
      });
    }
  }
  return [...totals.values()]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 5);
}

export function dailyTotal(report: DailyReport): number {
  return (Number(report.totalMale) || 0) + (Number(report.totalFemale) || 0);
}

export function peakReport(reports: readonly DailyReport[]): DailyReport | null {
  return reports.reduce<DailyReport | null>((peak, report) => {
    if (!peak || dailyTotal(report) > dailyTotal(peak)) return report;
    return peak;
  }, null);
}

export function recordedDayAverage(reports: readonly DailyReport[]): number {
  if (reports.length === 0) return 0;
  return Math.round(reports.reduce((total, report) => total + dailyTotal(report), 0) / reports.length);
}
