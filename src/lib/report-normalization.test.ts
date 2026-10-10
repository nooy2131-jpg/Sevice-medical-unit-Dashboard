import { describe, expect, it } from "bun:test";
import type { DailyReport } from "../types/report";
import type { ReportMapping } from "../types/normalization";
import { aggregateNormalizedGroups, aggregateNormalizedItems, normalizeReportItem, normalizeReportTopItems } from "./report-normalization";

const baseReport = (disease: string, procedure = "ล้างแผล"): DailyReport => ({
  reportDate: "2025-01-01", totalMale: 3, totalFemale: 2, thaiMale: 0, thaiFemale: 0,
  genMale: 0, genFemale: 0, procMale: 0, procFemale: 0, refillMale: 0, refillFemale: 0,
  referDocMale: 0, referDocFemale: 0, admitMale: 0, admitFemale: 0, referOutMale: 0, referOutFemale: 0,
  topDiseases: [{ name: disease, count: 3, male: 1, female: 2 }],
  topProcedures: [{ name: procedure, count: 2 }], reporterNote: "", updatedAt: "2025-01-01T00:00:00.000Z",
});

const mapping = (overrides: Partial<ReportMapping>): ReportMapping => ({
  id: "m", kind: "disease", rawName: "ไข้", normalizedName: "Fever", groupName: "Infection", version: 1, ...overrides,
});

describe("report normalization", () => {
  it("uses approved exact kind+raw mappings without mutating reports", () => {
    const report = baseReport("ไข้");
    const before = structuredClone(report);
    const item = normalizeReportItem(report.topDiseases[0], "disease", [mapping({})]);
    expect(item.status).toBe("mapped");
    expect(item.name).toBe("Fever");
    expect(report).toEqual(before);
    expect(normalizeReportItem({ name: "ไข้", count: 1 }, "procedure", [mapping({ kind: "disease" })]).status).toBe("unmapped");
    expect(normalizeReportItem({ name: " ไข้ ", count: 1 }, "disease", [mapping({})]).status).toBe("unmapped");
    const alias = { name: "Common cld ", count: 1, male: 0, female: 1 };
    expect(normalizeReportItem(alias, "disease", [mapping({ rawName: "Common cld ", normalizedName: "Common cold" })])).toMatchObject({ name: "Common cold", male: 0, female: 1 });
    expect(normalizeReportItem(alias, "disease", [mapping({ rawName: "Common cld", normalizedName: "Wrong mapping" })]).status).toBe("unmapped");
    const normalized = normalizeReportTopItems([alias], "disease", [mapping({ rawName: "Common cld ", normalizedName: "Common cold" })]);
    expect(normalized[0]).toMatchObject({ name: "Common cold", male: 0, female: 1 });
    expect(normalized[0]?.rawBreakdown[0]?.rawName).toBe("Common cld ");
  });

  it("conserves totals and keeps mapped/unmapped same-label entries distinct", () => {
    const reports = [baseReport("ไข้"), baseReport("Fever")];
    const items = aggregateNormalizedItems(reports, "topDiseases", [mapping({})]);
    expect(items.reduce((sum, item) => sum + item.count, 0)).toBe(6);
    expect(items.map((item) => `${item.status}:${item.name}`)).toEqual(["mapped:Fever", "unmapped:Fever"]);
    expect(items[0].rawBreakdown[0]?.rawName).toBe("ไข้");
  });

  it("includes unclassified group totals and preserves missing gender values", () => {
    const reports = [baseReport("ไข้"), baseReport("ไม่ทราบ")];
    const groups = aggregateNormalizedGroups(reports, "topDiseases", [mapping({})]);
    expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(6);
    expect(groups.some((group) => group.status === "unmapped" && group.groupName === "")).toBe(true);
    expect(aggregateNormalizedItems([{ ...baseReport("ไข้"), topDiseases: [{ name: "ไข้", count: 3 }] }], "topDiseases", [mapping({})])[0].male).toBeUndefined();
  });
});
