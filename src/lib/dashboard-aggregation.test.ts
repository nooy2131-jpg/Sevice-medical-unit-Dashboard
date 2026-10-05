import { describe, expect, it } from "bun:test";
import { aggregateRankedItems, dailyTotal, peakReport, recordedDayAverage } from "./dashboard-aggregation";
import type { DailyReport } from "../types/report";

const report = (date: string, male: number, female: number, name: string, itemMale: number, itemFemale: number): DailyReport => ({
  reportDate: date,
  totalMale: male,
  totalFemale: female,
  thaiMale: 0,
  thaiFemale: 0,
  genMale: 0,
  genFemale: 0,
  procMale: 0,
  procFemale: 0,
  refillMale: 0,
  refillFemale: 0,
  referDocMale: 0,
  referDocFemale: 0,
  admitMale: 0,
  admitFemale: 0,
  referOutMale: 0,
  referOutFemale: 0,
  topDiseases: [{ name, count: itemMale + itemFemale, male: itemMale, female: itemFemale }],
  topProcedures: [],
  reporterNote: "",
  updatedAt: "2025-01-01T00:00:00.000Z",
});

describe("dashboard aggregation", () => {
  it("aggregates ranked items and preserves gender breakdowns", () => {
    const items = aggregateRankedItems([
      report("2025-01-01", 3, 2, "A", 2, 1),
      report("2025-01-02", 4, 1, "A", 1, 2),
    ], "topDiseases");
    expect(items).toEqual([{ name: "A", count: 6, male: 3, female: 3 }]);
  });

  it("computes peak and recorded-day average", () => {
    const reports = [report("2025-01-01", 2, 1, "A", 1, 0), report("2025-01-02", 8, 0, "B", 0, 1)];
    expect(dailyTotal(reports[0])).toBe(3);
    expect(peakReport(reports)?.reportDate).toBe("2025-01-02");
    expect(recordedDayAverage(reports)).toBe(6);
    expect(recordedDayAverage([])).toBe(0);
    expect(recordedDayAverage([report("2025-01-03", 70, 0, "C", 0, 0)])).toBe(70);
  });
});
