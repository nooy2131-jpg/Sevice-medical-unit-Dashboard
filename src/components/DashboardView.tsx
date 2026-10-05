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
  aggregateRankedItems,
  dailyTotal,
  peakReport,
  recordedDayAverage,
} from "../lib/dashboard-aggregation";

export interface DashboardViewProps {
  reports: DailyReport[];
  periodEndDate: string;
  onPeriodChange: (date: string) => void;
  onEditDate: (date: string) => void;
  onNewReport: (date?: string) => void;
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
  const diseases = aggregateRankedItems(periodReports, "topDiseases");
  const procedures = aggregateRankedItems(periodReports, "topProcedures");
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
  return (
    <div className="mx-auto max-w-7xl space-y-6">
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
      <div className="grid gap-4 sm:grid-cols-3">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold sm:px-6">วันที่</th>
                <th className="px-4 py-3 text-right font-semibold">รวม ชาย</th>
                <th className="px-4 py-3 text-right font-semibold">รวม หญิง</th>
                <th className="px-4 py-3 text-right font-semibold">
                  รวมทั้งหมด
                </th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3 text-right font-semibold">จัดการ</th>
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
                    <td className="px-4 py-3 text-right">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
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
        <div className="mt-5 flex h-56 items-end gap-2 overflow-x-auto border-b border-slate-200 px-1 pb-2 sm:gap-3">
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
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-base font-bold text-slate-900">
            โรคที่พบบ่อย
          </h2>
          <ol className="mt-4 space-y-3">
            {diseases.map((item, index) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 text-sm"
              >
                <span>
                  <span className="mr-2 font-mono text-xs text-slate-500">
                    {index + 1}
                  </span>
                  {item.name}
                </span>
                <span className="text-right font-mono font-semibold tabular-nums text-slate-700">
                  {item.count}
                  <span className="ml-2 text-xs font-normal text-slate-500">(ช {item.male} · ญ {item.female})</span>
                </span>
              </li>
            ))}
            {diseases.length === 0 && (
              <li className="text-sm text-slate-500">
                ยังไม่มีข้อมูลโรคในช่วงนี้
              </li>
            )}
          </ol>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-base font-bold text-slate-900">
            หัตถการที่พบบ่อย
          </h2>
          <ol className="mt-4 space-y-3">
            {procedures.map((item, index) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 text-sm"
              >
                <span>
                  <span className="mr-2 font-mono text-xs text-slate-500">
                    {index + 1}
                  </span>
                  {item.name}
                </span>
                <span className="text-right font-mono font-semibold tabular-nums text-slate-700">
                  {item.count}
                  <span className="ml-2 text-xs font-normal text-slate-500">(ช {item.male} · ญ {item.female})</span>
                </span>
              </li>
            ))}
            {procedures.length === 0 && (
              <li className="text-sm text-slate-500">
                ยังไม่มีข้อมูลหัตถการในช่วงนี้
              </li>
            )}
          </ol>
        </section>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-bold text-slate-900">บันทึกหมายเหตุประจำวัน</h2>
          <p className="mt-1 text-xs text-slate-500">เหตุการณ์สำคัญและการส่งต่อจากเจ้าหน้าที่ในช่วงที่เลือก</p>
        </div>
        <div className="divide-y divide-slate-100">
          {[...periodReports].reverse().slice(0, 5).map((report) => (
            <div key={report.reportDate} className="flex flex-col justify-between gap-2 py-3 text-sm sm:flex-row sm:items-center">
              <div>
                <p className="text-xs text-slate-500">{formatThaiDate(report.reportDate, true)} · รวม {dailyTotal(report).toLocaleString("th-TH")} ราย</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{report.reporterNote || "ไม่มีหมายเหตุเพิ่มเติม"}</p>
              </div>
              <button type="button" onClick={() => onEditDate(report.reportDate)} className="self-start text-xs font-semibold text-teal-700 hover:underline sm:self-center">แก้ไขข้อมูลย้อนหลัง</button>
            </div>
          ))}
          {periodReports.length === 0 && <p className="py-4 text-sm text-slate-500">ยังไม่มีรายงานในช่วงนี้</p>}
        </div>
      </section>
    </div>
  );
}
