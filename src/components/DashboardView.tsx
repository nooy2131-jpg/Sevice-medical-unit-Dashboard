"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Pencil,
  Printer,
} from "lucide-react";
import {
  DailyReport,
  formatThaiDate,
} from "../types/report";
import { isCalendarDate, shiftDate } from "../lib/dates";
import {
  aggregateCanonicalGroups,
  aggregateCanonicalItems,
  dailyTotal,
  peakReport,
  recordedDayAverage,
} from "../lib/dashboard-aggregation";
import type { ReportMapping } from "../types/normalization";
import { rawReportTopItems } from "../lib/report-normalization";

export interface DashboardViewProps {
  reports: DailyReport[];
  periodEndDate: string;
  onPeriodChange: (date: string) => void;
  onEditDate: (date: string) => void;
  onNewReport: (date?: string) => void;
  mappings?: readonly ReportMapping[];
}
type RangeMode = "7D" | "MONTH" | "ALL" | "SINGLE";

function safeShiftDate(value: string, delta: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  try {
    return shiftDate(value, delta);
  } catch {
    return "";
  }
}

function metric(reports: DailyReport[], key: keyof DailyReport): number {
  return reports.reduce(
    (total, report) => total + (Number(report[key]) || 0),
    0,
  );
}

export function DashboardView({
  reports,
  periodEndDate,
  onPeriodChange,
  onEditDate,
  onNewReport,
  mappings = [],
}: DashboardViewProps) {
  const [rangeMode, setRangeMode] = useState<RangeMode>("7D");
  const [singleDate, setSingleDate] = useState(periodEndDate);
  const dates = Array.from({ length: 7 }, (_, index) =>
    safeShiftDate(periodEndDate, index - 6),
  );
  const byDate = new Map(reports.map((report) => [report.reportDate, report]));
  const visibleDates =
    rangeMode === "7D"
      ? dates
      : rangeMode === "SINGLE"
        ? [singleDate]
        : reports
            .filter((report) =>
              rangeMode === "MONTH"
                ? report.reportDate.slice(0, 7) === periodEndDate.slice(0, 7)
                : true,
            )
            .map((report) => report.reportDate);
  const periodReports = visibleDates.flatMap((date) => {
    const report = byDate.get(date);
    return report ? [report] : [];
  });
  const totalMale = metric(periodReports, "totalMale");
  const totalFemale = metric(periodReports, "totalFemale");
  const total = totalMale + totalFemale;
  const averageDenominator = periodReports.length;
  const missing =
    rangeMode === "7D" ? dates.filter((date) => !byDate.has(date)) : [];
  const diseases = aggregateCanonicalItems(periodReports, "topDiseases", mappings);
  const procedures = aggregateCanonicalItems(periodReports, "topProcedures", mappings);
  const diseaseGroups = aggregateCanonicalGroups(periodReports, "topDiseases", mappings);
  const procedureGroups = aggregateCanonicalGroups(periodReports, "topProcedures", mappings);
  const trendDates = rangeMode === "7D" ? dates : visibleDates;
  const maxTrendTotal = Math.max(1, ...trendDates.map((date) => {
    const report = byDate.get(date);
    return report ? dailyTotal(report) : 0;
  }));
  const peak = peakReport(periodReports);
  const serviceRows = [
    [
      "ตรวจโรคทั่วไป",
      metric(periodReports, "genMale"),
      metric(periodReports, "genFemale"),
    ],
    [
      "แพทย์แผนไทย",
      metric(periodReports, "thaiMale"),
      metric(periodReports, "thaiFemale"),
    ],
    [
      "ทำหัตถการ",
      metric(periodReports, "procMale"),
      metric(periodReports, "procFemale"),
    ],
    [
      "รับยาต่อเนื่อง / เติมยาเดิม",
      metric(periodReports, "refillMale"),
      metric(periodReports, "refillFemale"),
    ],
    [
      "ขอใบส่งตัว",
      metric(periodReports, "referDocMale"),
      metric(periodReports, "referDocFemale"),
    ],
    [
      "Admit",
      metric(periodReports, "admitMale"),
      metric(periodReports, "admitFemale"),
    ],
    [
      "Refer Out",
      metric(periodReports, "referOutMale"),
      metric(periodReports, "referOutFemale"),
    ],
  ] as const;
  const renderNormalizedItems = (items: typeof diseases, emptyLabel: string) => (
    <ol className="mt-4 space-y-3">
      {items.map((item, index) => (
        <li key={item.key} className="border-b border-slate-100 pb-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="min-w-0">
              <span className="mr-2 font-mono text-xs text-slate-500">{index + 1}</span>
              <span className="font-medium text-slate-900">{item.name}</span>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === "mapped" ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>
                {item.status === "mapped" ? "มาตรฐานแล้ว" : "ยังไม่จัดกลุ่ม"}
              </span>
              {item.groupName && <span className="ml-2 text-xs text-slate-500">กลุ่ม {item.groupName}</span>}
            </span>
            <span className="shrink-0 text-right font-mono font-semibold tabular-nums text-slate-700">
              {item.count}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {item.male === undefined && item.female === undefined ? "(ไม่ระบุ ช/ญ)" : `(ช ${item.male ?? "—"} · ญ ${item.female ?? "—"})`}
              </span>
            </span>
          </div>
          <details className="mt-2 pl-5 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-600">ดูชื่อดิบ ({item.rawBreakdown.length})</summary>
            <ul className="mt-1 space-y-1 pl-4">
              {item.rawBreakdown.map((raw) => <li key={`${item.key}:${raw.rawName}`}>{raw.rawName} · {raw.count}</li>)}
            </ul>
          </details>
        </li>
      ))}
      {items.length === 0 && <li className="text-sm text-slate-500">{emptyLabel}</li>}
    </ol>
  );
  const renderGroups = (groups: typeof diseaseGroups) => (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group.key} className="border-b border-slate-100 py-2 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words"><span className="font-medium text-slate-800">{group.groupName || "ไม่จัดกลุ่ม"}</span><span className="ml-2 text-xs text-slate-500">{group.status === "mapped" ? "มาตรฐานแล้ว" : "ชื่อดิบ"}</span></span>
            <span className="shrink-0 font-mono font-semibold tabular-nums text-slate-700">{group.count}</span>
          </div>
          <details className="mt-1 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-600">ดูชื่อในกลุ่ม ({group.items.length})</summary>
            <ul className="mt-1 space-y-1 pl-4">
              {group.items.map((item) => <li key={item.key}>{item.name} · {item.count}{item.rawBreakdown.length > 1 ? ` (${item.rawBreakdown.map((raw) => raw.rawName).join(", ")})` : ""}</li>)}
            </ul>
          </details>
        </div>
      ))}
      {groups.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีข้อมูลในช่วงนี้</p>}
    </div>
  );
  return (
    <div className="dashboard-view mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            หน่วยบริการชั่วคราว โรงพยาบาลองครักษ์
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">
            ภาพรวมสถิติผู้รับบริการ
          </h1>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onPeriodChange(safeShiftDate(periodEndDate, -7))}
            className="control-button"
            aria-label="ช่วงก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" />
            ก่อนหน้า
          </button>
          <label htmlFor="period-end" className="sr-only">
            วันสิ้นสุดช่วงรายงาน
          </label>
          <input
            id="period-end"
            type="date"
            value={periodEndDate}
            onChange={(event) => {
              if (isCalendarDate(event.target.value)) onPeriodChange(event.target.value);
            }}
            className="control-input font-mono tabular-nums"
          />
          <button
            type="button"
            onClick={() => onPeriodChange(safeShiftDate(periodEndDate, 7))}
            className="control-button"
            aria-label="ช่วงถัดไป"
          >
            ถัดไป
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="control-button"
          >
            <Printer className="h-4 w-4" />
            พิมพ์
          </button>
          <button
            type="button"
            onClick={() => onNewReport()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <FilePlus2 className="h-4 w-4" />
            บันทึกวันนี้
          </button>
        </div>
      </div>
      <div
        className="no-print flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="ช่วงสถิติ"
      >
        {(
          [
            ["7D", "7 วัน"],
            ["MONTH", "เดือนนี้"],
            ["ALL", "ทั้งหมด"],
            ["SINGLE", "วันที่เดียว"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={rangeMode === value}
            onClick={() => setRangeMode(value)}
            className={
              rangeMode === value
                ? "rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
                : "control-button"
            }
          >
            {label}
          </button>
        ))}
        {rangeMode === "SINGLE" && (
          <>
            <label htmlFor="single-report-date" className="sr-only">
              วันที่เดียวที่ต้องการดู
            </label>
            <input
              id="single-report-date"
              type="date"
              value={singleDate}
              onChange={(event) => {
                if (isCalendarDate(event.target.value)) setSingleDate(event.target.value);
              }}
              className="control-input font-mono text-xs"
            />
          </>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <CalendarDays className="h-4 w-4 text-teal-700" />
        <span>
          {rangeMode === "7D"
            ? `แสดง 7 วันปฏิทิน: ${formatThaiDate(dates[0], true)} – ${formatThaiDate(dates[6], true)}`
            : rangeMode === "MONTH"
              ? `ข้อมูลเดือน ${formatThaiDate(periodEndDate).split(" ")[1]} ${formatThaiDate(periodEndDate).split(" ")[2]}`
              : rangeMode === "SINGLE"
                ? `วันที่ ${formatThaiDate(singleDate)}`
                : "ข้อมูลทั้งหมดที่บันทึกไว้"}
        </span>
      </div>
      {missing.length > 0 && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          ยังไม่มีรายงานสำหรับ {missing.length} วัน:{" "}
          {missing.map((date) => (
            <button
              type="button"
              key={date}
              onClick={() => onNewReport(date)}
              className="ml-1 font-semibold underline underline-offset-2"
            >
              {formatThaiDate(date, true)}
            </button>
          ))}
        </div>
      )}
      <div className="dashboard-summary grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">ผู้รับบริการรวมในช่วงนี้</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">
            {total.toLocaleString("th-TH")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ชาย {totalMale.toLocaleString("th-TH")} · หญิง{" "}
            {totalFemale.toLocaleString("th-TH")}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">วันที่บันทึกแล้ว</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">
            {periodReports.length}
            {rangeMode === "7D" && (
              <span className="text-lg font-normal text-slate-500"> / 7</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {averageDenominator
              ? `เฉลี่ย ${recordedDayAverage(periodReports).toLocaleString("th-TH")} รายต่อวันที่บันทึก`
              : "ยังไม่มีวันที่บันทึกในช่วงนี้"}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">แพทย์แผนไทยในช่วงนี้</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">
            {(
              metric(periodReports, "thaiMale") +
              metric(periodReports, "thaiFemale")
            ).toLocaleString("th-TH")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ยอดหมวดบริการอาจนับซ้ำกับยอดรวม
          </p>
        </article>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 className="font-display text-base font-bold text-slate-900">
            รายงานรายวัน
          </h2>
        </div>
        <div className="mobile-report-list grid gap-3 p-4 md:hidden">
          {visibleDates.length === 0 && <p className="text-sm text-slate-600">ยังไม่มีรายงานในช่วงนี้</p>}
          {visibleDates.map((date) => {
            const report = byDate.get(date);
            return <article key={date} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-semibold text-slate-900">{formatThaiDate(date, true)}</h3><p className="mt-1 text-xs text-slate-500">{report ? "บันทึกแล้ว" : "ยังไม่มีรายงาน"}</p></div>
                <p className="shrink-0 text-right"><span className="font-mono text-2xl font-bold tabular-nums text-slate-950">{report ? dailyTotal(report).toLocaleString("th-TH") : "—"}</span><span className="ml-1 text-xs text-slate-500">ราย</span></p>
              </div>
              {report ? <>
                <p className="mt-2 text-sm text-slate-600">ชาย {report.totalMale} · หญิง {report.totalFemale}</p>
                <details className="mt-3 border-t border-slate-100">
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-teal-700">ดูรายละเอียด</summary>
                  <dl className="space-y-2 text-sm">
                    {[
                      ["ตรวจโรคทั่วไป", report.genMale, report.genFemale],
                      ["แพทย์แผนไทย", report.thaiMale, report.thaiFemale],
                      ["ทำหัตถการ", report.procMale, report.procFemale],
                      ["รับยาต่อเนื่อง", report.refillMale, report.refillFemale],
                      ["ขอใบส่งตัว", report.referDocMale, report.referDocFemale],
                      ["Admit", report.admitMale, report.admitFemale],
                      ["Refer Out", report.referOutMale, report.referOutFemale],
                    ].map(([label, male, female]) => <div key={label} className="flex items-start justify-between gap-3"><dt className="min-w-0 break-words text-slate-600">{label}</dt><dd className="shrink-0 text-right text-slate-900">{Number(male) + Number(female)}<span className="block text-xs text-slate-500">ช {male} · ญ {female}</span></dd></div>)}
                  </dl>
                  {([['โรคที่บันทึก', report.topDiseases], ['หัตถการที่บันทึก', report.topProcedures]] as const).map(([label, items]) => <div key={label} className="mt-4"><h4 className="text-sm font-semibold text-slate-900">{label}</h4><ul className="mt-2 space-y-2 text-sm text-slate-600">{rawReportTopItems(items).map((item, index) => <li key={index} className="flex justify-between gap-3"><span className="min-w-0 break-words">{item.name}</span><span className="shrink-0 text-right"><span className="font-mono tabular-nums">{item.count}</span><span className="block text-xs text-slate-500">{item.male === undefined && item.female === undefined ? "ไม่ระบุ ช/ญ" : `ช ${item.male ?? "—"} · ญ ${item.female ?? "—"}`}</span></span></li>)}</ul>{items.length === 0 && <p className="mt-1 text-sm text-slate-500">ไม่มีรายการ</p>}</div>)}
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-600"><strong className="text-slate-900">หมายเหตุ: </strong>{report.reporterNote || "ไม่มีหมายเหตุเพิ่มเติม"}</p>
                </details>
                <button type="button" onClick={() => onEditDate(date)} className="control-button mt-2 w-full justify-center"><Pencil className="h-4 w-4" />แก้ไขรายงาน</button>
              </> : <button type="button" onClick={() => onNewReport(date)} className="control-button mt-3 w-full justify-center"><FilePlus2 className="h-4 w-4" />เพิ่มรายงาน</button>}
            </article>;
          })}
        </div>
        <div className="screen-table report-table-scroll hidden overflow-x-auto md:block">
          <table className="report-table w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold sm:px-6">วันที่</th>
                <th className="px-4 py-3 text-right font-semibold">รวม ชาย</th>
                <th className="px-4 py-3 text-right font-semibold">รวม หญิง</th>
                <th className="px-4 py-3 text-right font-semibold">
                  รวมทั้งหมด
                </th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                <th className="no-print px-4 py-3 text-right font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleDates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center sm:px-6">
                    <p className="text-sm font-semibold text-slate-700">
                      ยังไม่มีรายงานในช่วงนี้
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      เลือกช่วงอื่นหรือเริ่มบันทึกรายงานวันนี้
                    </p>
                    <button
                      type="button"
                      onClick={() => onNewReport()}
                      className="control-button mt-4"
                    >
                      บันทึกรายงาน
                    </button>
                  </td>
                </tr>
              ) : visibleDates.map((date) => {
                const report = byDate.get(date);
                const dayTotal = report
                  ? report.totalMale + report.totalFemale
                  : 0;
                return (
                  <tr key={date} className="hover:bg-slate-50">
                    <td className="px-4 py-3 sm:px-6">
                      <span className="font-medium text-slate-900">
                        {formatThaiDate(date, true)}
                      </span>
                      <span className="ml-2 font-mono text-xs text-slate-500">
                        {date}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {report?.totalMale ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {report?.totalFemale ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {report ? dayTotal : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {report ? (
                        <span className="text-teal-700">บันทึกแล้ว</span>
                      ) : (
                        <span className="text-amber-700">ยังไม่มีข้อมูล</span>
                      )}
                    </td>
                    <td className="no-print px-4 py-3 text-right">
                      {report ? (
                        <button
                          type="button"
                          onClick={() => onEditDate(date)}
                          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          แก้ไข
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNewReport(date)}
                          className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          เพิ่มรายงาน
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 className="font-display text-base font-bold text-slate-900">
            สรุปตามประเภทบริการ
          </h2>
        </div>
        <dl className="mobile-report-list divide-y divide-slate-100 px-4 md:hidden">
          {serviceRows.map(([label, male, female]) => <div key={label} className="flex items-start justify-between gap-4 py-4"><dt className="min-w-0 break-words text-sm font-medium text-slate-900">{label}</dt><dd className="shrink-0 text-right"><span className="font-mono font-semibold tabular-nums text-slate-950">{male + female}</span><span className="mt-1 block text-xs text-slate-600">ชาย {male} · หญิง {female}</span></dd></div>)}
        </dl>
        <div className="screen-table report-table-scroll hidden overflow-x-auto md:block">
          <table className="report-table service-table w-full min-w-[600px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">ประเภทบริการ</th>
                <th className="px-4 py-3 text-right font-semibold">ชาย</th>
                <th className="px-4 py-3 text-right font-semibold">หญิง</th>
                <th className="px-4 py-3 text-right font-semibold">รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {serviceRows.map(([label, male, female]) => (
                <tr key={label}>
                  <td className="px-4 py-3">{label}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {male}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {female}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                    {male + female}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">แนวโน้มผู้รับบริการรายวัน</h2>
            <p className="mt-1 text-xs text-slate-500">แยกชายและหญิงในช่วงที่เลือก · คลิกวันที่เพื่อแก้ไข</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-600" />ชาย</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-teal-500" />หญิง</span>
          </div>
        </div>
        <div className="dashboard-trend mt-5 flex h-56 items-end gap-2 overflow-x-auto border-b border-slate-200 px-1 pb-2 sm:gap-3">
          {trendDates.map((date) => {
            const report = byDate.get(date);
            const totalForDay = report ? dailyTotal(report) : 0;
            const height = totalForDay ? Math.max(8, Math.round((totalForDay / maxTrendTotal) * 100)) : 2;
            const malePercent = totalForDay ? Math.round(((report?.totalMale ?? 0) / totalForDay) * 100) : 0;
            return (
              <button type="button" key={date} onClick={() => report ? onEditDate(date) : onNewReport(date)} aria-label={report ? `${formatThaiDate(date, true)} ชาย ${report.totalMale} ราย หญิง ${report.totalFemale} ราย รวม ${totalForDay} ราย` : `${formatThaiDate(date, true)} ยังไม่มีรายงาน`} className="group flex h-full min-w-10 flex-1 flex-col items-center justify-end focus:outline-none focus:ring-2 focus:ring-teal-700" title={report ? `${formatThaiDate(date, true)} รวม ${totalForDay} ราย` : `${formatThaiDate(date, true)} ยังไม่มีรายงาน`}>
                <span className="mb-1 font-mono text-[11px] tabular-nums text-slate-700">{report ? totalForDay : "—"}</span>
                <span className={`flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t-md ${report ? "bg-teal-500" : "bg-slate-200"}`} style={{ height: `${height}%` }}>
                  {report && <><span className="w-full bg-teal-500" style={{ height: `${100 - malePercent}%` }} /><span className="w-full bg-sky-600" style={{ height: `${malePercent}%` }} /></>}
                </span>
                <span className="mt-2 truncate text-[11px] tabular-nums text-slate-500">{date.slice(5)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-slate-600">
          วันที่มีผู้รับบริการสูงสุด: <strong className="text-slate-900">{peak ? `${formatThaiDate(peak.reportDate, true)} (${dailyTotal(peak).toLocaleString("th-TH")} ราย)` : "—"}</strong>
        </p>
      </section>
      <div className="dashboard-top-items grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-base font-bold text-slate-900">
            โรคที่พบบ่อย
          </h2>
          {renderNormalizedItems(diseases, "ยังไม่มีข้อมูลโรคในช่วงนี้")}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-base font-bold text-slate-900">
            หัตถการที่พบบ่อย
          </h2>
          {renderNormalizedItems(procedures, "ยังไม่มีข้อมูลหัตถการในช่วงนี้")}
        </section>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-bold text-slate-900">ยอดรวมตามกลุ่มมาตรฐาน</h2>
          <p className="mt-1 text-xs text-slate-500">รวมชื่อที่อนุมัติแล้ว และแยกชื่อที่ยังไม่จัดกลุ่มไว้ชัดเจน</p>
        </div>
        <div className="dashboard-groups grid gap-6 lg:grid-cols-2">
          <div><h3 className="mt-4 text-sm font-semibold text-slate-800">โรค</h3>{renderGroups(diseaseGroups)}</div>
          <div><h3 className="mt-4 text-sm font-semibold text-slate-800">หัตถการ</h3>{renderGroups(procedureGroups)}</div>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-bold text-slate-900">บันทึกหมายเหตุประจำวัน</h2>
          <p className="mt-1 text-xs text-slate-500">เหตุการณ์สำคัญและการส่งต่อจากเจ้าหน้าที่ในช่วงที่เลือก</p>
        </div>
        <div className="divide-y divide-slate-100">
          {[...periodReports].reverse().slice(0, 5).map((report) => (
            <div key={report.reportDate} className="dashboard-note flex flex-col justify-between gap-2 py-3 text-sm sm:flex-row sm:items-center">
              <div>
                <p className="text-xs text-slate-500">{formatThaiDate(report.reportDate, true)} · รวม {dailyTotal(report).toLocaleString("th-TH")} ราย</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{report.reporterNote || "ไม่มีหมายเหตุเพิ่มเติม"}</p>
              </div>
              <button type="button" onClick={() => onEditDate(report.reportDate)} className="no-print self-start text-xs font-semibold text-teal-700 hover:underline sm:self-center">แก้ไขข้อมูลย้อนหลัง</button>
            </div>
          ))}
          {periodReports.length === 0 && <p className="py-4 text-sm text-slate-500">ยังไม่มีรายงานในช่วงนี้</p>}
        </div>
      </section>
    </div>
  );
}
