"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Search, Trash2, Upload, X } from "lucide-react";
import {
  DailyReport,
  formatBangkokTimestamp,
  formatThaiDate,
  normalizeTopItems,
} from "../types/report";
import { parseReportsImport } from "../lib/csv";
import { validateReport } from "../lib/report-validation";

export interface ImportPreview {
  rows: DailyReport[];
  invalidRows: number;
  duplicateDates: string[];
}
export interface RecordsTableViewProps {
  reports: DailyReport[];
  isAdmin?: boolean;
  onEditDate: (date: string) => void;
  onDeleteDate: (date: string) => Promise<void>;
  onExportCsv: () => Promise<void> | void;
  onImportRows?: (
    rows: DailyReport[],
    duplicateMode: "skip" | "overwrite",
    expectedVersions: Record<string, number>,
  ) => Promise<void>;
}

function parsePreview(text: string, existing: DailyReport[]): ImportPreview {
  let parsed: unknown[];
  try {
    parsed = parseReportsImport(text);
  } catch {
    return { rows: [], invalidRows: 1, duplicateDates: [] };
  }
  const rows: DailyReport[] = [];
  let invalidRows = 0;
  const known = new Set(existing.map((report) => report.reportDate));
  const duplicateDates: string[] = [];
  for (const candidate of parsed) {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      invalidRows += 1;
      continue;
    }
    const cells = candidate as Record<string, unknown>;
    const reportDate =
      typeof cells.reportDate === "string" ? cells.reportDate : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      invalidRows += 1;
      continue;
    }
    if (
      known.has(reportDate) ||
      rows.some((row) => row.reportDate === reportDate)
    )
      duplicateDates.push(reportDate);
    const value = (key: string): number => {
      const raw = cells[key];
      if (raw === "") return 0;
      if (
        typeof raw !== "number" ||
        !Number.isFinite(raw) ||
        !Number.isSafeInteger(raw) ||
        raw < 0
      ) {
        throw new Error(`${key} must be a non-negative integer`);
      }
      return raw;
    };
    try {
      rows.push(
        validateReport({
          reportDate,
          totalMale: value("totalMale"),
          totalFemale: value("totalFemale"),
          thaiMale: value("thaiMale"),
          thaiFemale: value("thaiFemale"),
          genMale: value("genMale"),
          genFemale: value("genFemale"),
          procMale: value("procMale"),
          procFemale: value("procFemale"),
          refillMale: value("refillMale"),
          refillFemale: value("refillFemale"),
          referDocMale: value("referDocMale"),
          referDocFemale: value("referDocFemale"),
          admitMale: value("admitMale"),
          admitFemale: value("admitFemale"),
          referOutMale: value("referOutMale"),
          referOutFemale: value("referOutFemale"),
          topDiseases: cells.topDiseases,
          topProcedures: cells.topProcedures,
          reporterNote:
            typeof cells.reporterNote === "string" ? cells.reporterNote : "",
          updatedAt:
            typeof cells.updatedAt === "string"
              ? cells.updatedAt
              : new Date().toISOString(),
        }) as DailyReport,
      );
    } catch {
      invalidRows += 1;
    }
  }
  return { rows, invalidRows, duplicateDates: [...new Set(duplicateDates)] };
}

export function RecordsTableView({
  reports,
  isAdmin = false,
  onEditDate,
  onDeleteDate,
  onExportCsv,
  onImportRows,
}: RecordsTableViewProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "total-desc">(
    "date-desc",
  );
  const [inspectDate, setInspectDate] = useState<string | null>(null);
  const [deleteDate, setDeleteDate] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "overwrite">(
    "skip",
  );
  const [importError, setImportError] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      reports
        .filter((report) => {
          const normalized = query.trim().toLowerCase();
          if (!normalized) return true;
          return (
            report.reportDate.includes(normalized) ||
            formatThaiDate(report.reportDate).includes(normalized) ||
            report.reporterNote.toLowerCase().includes(normalized) ||
            normalizeTopItems(report.topDiseases).some((item) =>
              item.name.toLowerCase().includes(normalized),
            ) ||
            normalizeTopItems(report.topProcedures).some((item) =>
              item.name.toLowerCase().includes(normalized),
            )
          );
        })
        .sort((a, b) =>
          sort === "date-asc"
            ? a.reportDate.localeCompare(b.reportDate)
            : sort === "total-desc"
              ? b.totalMale + b.totalFemale - (a.totalMale + a.totalFemale)
              : b.reportDate.localeCompare(a.reportDate),
        ),
    [reports, query, sort],
  );
  const inspect = inspectDate
    ? reports.find((report) => report.reportDate === inspectDate)
    : null;
  const openImport = (value: string) => {
    setImportError(null);
    setImportPreview(value.trim() ? parsePreview(value, reports) : null);
  };
  const submitImport = async () => {
    if (!importPreview || !onImportRows) return;
    if (!importPreview.rows.length) {
      setImportError("ไม่พบแถวที่นำเข้าได้");
      return;
    }
    if (importPreview.invalidRows > 0) {
      setImportError("ไฟล์มีแถวไม่ถูกต้อง กรุณาแก้ไขไฟล์ก่อนนำเข้า");
      return;
    }
    const dates = importPreview.rows.map((row) => row.reportDate);
    if (new Set(dates).size !== dates.length) {
      setImportError("ไฟล์มีวันที่ซ้ำกันภายในไฟล์ กรุณาแก้ไขก่อนนำเข้า");
      return;
    }
    const expectedVersions = Object.fromEntries(
      importPreview.rows.flatMap((row) => {
        const current = reports.find(
          (report) => report.reportDate === row.reportDate,
        );
        return current?.version === undefined
          ? []
          : [[row.reportDate, current.version]];
      }),
    );
    try {
      await onImportRows(importPreview.rows, duplicateMode, expectedVersions);
    } catch (reason) {
      setImportError(
        reason instanceof Error ? reason.message : "นำเข้ารายงานไม่สำเร็จ",
      );
      return;
    }
    setImportPreview(null);
  };
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            หน่วยบริการชั่วคราว โรงพยาบาลองครักษ์ · บันทึกทั้งหมด{" "}
            {reports.length} วัน
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">
            ตารางรายงานย้อนหลัง
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <span className="sr-only">ค้นหารายงาน</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาวันที่ โรค หัตถการ…"
              className="control-input pl-9 text-sm"
            />
          </label>
          <label>
            <span className="sr-only">เรียงลำดับ</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="control-input text-sm"
            >
              <option value="date-desc">วันที่ล่าสุดก่อน</option>
              <option value="date-asc">วันที่เก่าสุดก่อน</option>
              <option value="total-desc">ยอดรวมมากสุดก่อน</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void onExportCsv()}
            className="control-button"
          >
            <Download className="h-4 w-4" />
            ส่งออก CSV
          </button>
          {isAdmin && onImportRows && (
            <label className="control-button cursor-pointer">
              <Upload className="h-4 w-4" />
              นำเข้า CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file.text().then(openImport);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">วันที่รายงาน</th>
                <th className="px-4 py-3 text-right font-semibold">
                  ผู้รับบริการ ชาย
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  ผู้รับบริการ หญิง
                </th>
                <th className="px-4 py-3 text-right font-semibold">รวม</th>
                <th className="px-4 py-3 font-semibold">โรคอันดับ 1</th>
                <th className="px-4 py-3 font-semibold">อัปเดตล่าสุด</th>
                <th className="px-4 py-3 text-right font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    ยังไม่มีข้อมูลรายงาน
                  </td>
                </tr>
              ) : (
                filtered.map((report) => (
                  <tr key={report.reportDate} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">
                        {formatThaiDate(report.reportDate, true)}
                      </span>
                      <span className="ml-2 font-mono text-xs text-slate-500">
                        {report.reportDate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {report.totalMale}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {report.totalFemale}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                      {report.totalMale + report.totalFemale}
                    </td>
                    <td className="max-w-56 truncate px-4 py-3">
                      {normalizeTopItems(report.topDiseases)[0]?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <span className="block">
                        {report.lastEditor?.name ?? report.updatedBy ?? "—"}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatBangkokTimestamp(report.updatedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectDate(report.reportDate)}
                          className="control-button px-2"
                          aria-label={`ดูรายงาน ${report.reportDate}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditDate(report.reportDate)}
                          className="control-button px-2"
                        >
                          แก้ไข
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteDate(report.reportDate)}
                            className="control-button px-2 text-rose-700"
                            aria-label={`ลบรายงาน ${report.reportDate}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {inspect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="inspect-title"
                  className="font-display text-xl font-bold text-slate-900"
                >
                  รายงานวันที่ {formatThaiDate(inspect.reportDate)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  อัปเดตโดย{" "}
                  {inspect.lastEditor?.name ?? inspect.updatedBy ?? "ไม่ระบุ"} ·{" "}
                  {formatBangkokTimestamp(inspect.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectDate(null)}
                className="control-button px-2"
                aria-label="ปิด"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["ชาย", inspect.totalMale],
                ["หญิง", inspect.totalFemale],
                [
                  "แพทย์แผนไทย ช/ญ",
                  `${inspect.thaiMale}/${inspect.thaiFemale}`,
                ],
                [
                  "ตรวจโรคทั่วไป ช/ญ",
                  `${inspect.genMale}/${inspect.genFemale}`,
                ],
                ["หัตถการ ช/ญ", `${inspect.procMale}/${inspect.procFemale}`],
                [
                  "รับยาเดิม ช/ญ",
                  `${inspect.refillMale}/${inspect.refillFemale}`,
                ],
                [
                  "ใบส่งตัว ช/ญ",
                  `${inspect.referDocMale}/${inspect.referDocFemale}`,
                ],
                ["Admit ช/ญ", `${inspect.admitMale}/${inspect.admitFemale}`],
                [
                  "Refer Out ช/ญ",
                  `${inspect.referOutMale}/${inspect.referOutFemale}`,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 font-mono font-semibold tabular-nums text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  โรคที่พบบ่อย
                </h3>
                <ol className="mt-2 space-y-1 text-sm text-slate-700">
                  {normalizeTopItems(inspect.topDiseases).map((item, index) => (
                    <li
                      key={`${item.name}-${index}`}
                      className="flex justify-between gap-2"
                    >
                      <span>
                        {index + 1}. {item.name}
                      </span>
                      <span className="font-mono">{item.count}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  หัตถการ
                </h3>
                <ol className="mt-2 space-y-1 text-sm text-slate-700">
                  {normalizeTopItems(inspect.topProcedures).map(
                    (item, index) => (
                      <li
                        key={`${item.name}-${index}`}
                        className="flex justify-between gap-2"
                      >
                        <span>
                          {index + 1}. {item.name}
                        </span>
                        <span className="font-mono">{item.count}</span>
                      </li>
                    ),
                  )}
                </ol>
              </div>
            </div>
            {inspect.reporterNote && (
              <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <strong>หมายเหตุภาพรวม:</strong> {inspect.reporterNote}
              </p>
            )}
          </div>
        </div>
      )}
      {deleteDate && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2
              id="delete-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              ลบรายงานวันที่ {formatThaiDate(deleteDate, true)}?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              ข้อมูลที่ลบจะไม่แสดงใน dashboard และตารางย้อนหลัง
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteDate(null)}
                className="control-button"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const date = deleteDate;
                  setDeleteDate(null);
                  void onDeleteDate(date);
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}
      {importPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-title"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="import-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  ตรวจสอบไฟล์นำเข้า
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  นำเข้าได้ {importPreview.rows.length} แถว · แถวไม่ถูกต้อง{" "}
                  {importPreview.invalidRows} แถว
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="control-button px-2"
                aria-label="ปิด"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {importPreview.duplicateDates.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                พบวันที่ซ้ำ {importPreview.duplicateDates.length} วัน:{" "}
                {importPreview.duplicateDates.join(", ")}
                <div className="mt-3 flex gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={duplicateMode === "skip"}
                      onChange={() => setDuplicateMode("skip")}
                    />
                    ข้ามวันที่ซ้ำ
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={duplicateMode === "overwrite"}
                      onChange={() => setDuplicateMode("overwrite")}
                    />
                    เขียนทับวันที่ซ้ำ
                  </label>
                </div>
              </div>
            )}
            {importError && (
              <p className="mt-3 text-sm text-rose-700" role="alert">
                {importError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="control-button"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void submitImport()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                ยืนยันนำเข้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
