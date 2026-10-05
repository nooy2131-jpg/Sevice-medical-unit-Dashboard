"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Search, Trash2, Upload, X } from "lucide-react";
import { Dialog } from "./Dialog";
import {
  DailyReport,
  formatBangkokTimestamp,
  formatThaiDate,
  normalizeTopItems,
} from "../types/report";
import { parseReportsImport } from "../lib/csv";
import { isCalendarDate, todayBangkok } from "../lib/dates";
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(todayBangkok());
  const [dateError, setDateError] = useState<string | null>(null);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pasteImportText, setPasteImportText] = useState("");
  const [pasteImportError, setPasteImportError] = useState<string | null>(null);
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
  const openSelectedDate = () => {
    if (!isCalendarDate(dateToOpen)) {
      setDateError("กรุณาเลือกวันที่ตามปฏิทินที่ถูกต้อง");
      return;
    }
    setDateError(null);
    onEditDate(dateToOpen);
  };
  const submitPasteImport = () => {
    if (!pasteImportText.trim()) {
      setPasteImportError("กรุณาวางข้อมูลที่ต้องการนำเข้า");
      return;
    }
    setPasteImportError(null);
    openImport(pasteImportText);
    setPasteImportText("");
    setPasteImportOpen(false);
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
    setImportBusy(true);
    try {
      await onImportRows(importPreview.rows, duplicateMode, expectedVersions);
    } catch (reason) {
      setImportError(
        reason instanceof Error ? reason.message : "นำเข้ารายงานไม่สำเร็จ",
      );
      return;
    } finally {
      setImportBusy(false);
    }
    setImportPreview(null);
  };
  const submitDelete = async () => {
    if (!deleteDate) return;
    const date = deleteDate;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDeleteDate(date);
      setDeleteDate(null);
    } catch (reason) {
      setDeleteError(
        reason instanceof Error ? reason.message : "ลบรายงานไม่สำเร็จ",
      );
    } finally {
      setDeleteBusy(false);
    }
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
        <div className="flex flex-wrap items-end gap-2">
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
              className="control-select text-sm"
            >
              <option value="date-desc">วันที่ล่าสุดก่อน</option>
              <option value="date-asc">วันที่เก่าสุดก่อน</option>
              <option value="total-desc">ยอดรวมมากสุดก่อน</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="block">
              <span className="sr-only">วันที่รายงานที่ต้องการเปิด</span>
              <input
                type="date"
                value={dateToOpen}
                onChange={(event) => {
                  setDateToOpen(event.target.value);
                  setDateError(null);
                }}
                aria-describedby={dateError ? "records-date-error" : undefined}
                className="control-input font-mono text-sm tabular-nums"
              />
            </label>
            <button
              type="button"
              onClick={openSelectedDate}
              className="control-button"
            >
              เปิดรายงาน
            </button>
          </div>
          {dateError && (
            <p id="records-date-error" className="basis-full text-sm text-rose-700" role="alert">
              {dateError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void onExportCsv()}
            className="control-button"
            disabled={reports.length === 0}
          >
            <Download className="h-4 w-4" />
            ส่งออก CSV
          </button>
          {isAdmin && onImportRows && (
            <>
              <label className="control-button cursor-pointer">
                <Upload className="h-4 w-4" />
                นำเข้าไฟล์
                <input
                  type="file"
                  accept=".csv,text/csv,.tsv,text/tab-separated-values,.json,application/json"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void file.text().then(openImport);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setPasteImportError(null);
                  setPasteImportOpen(true);
                }}
                className="control-button"
              >
                วาง CSV / JSON / TSV
              </button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">วันที่รายงาน</th>
                <th className="px-4 py-3 text-right font-semibold">
                  ผู้รับบริการรวม (ช/ญ)
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  แพทย์แผนไทย (ช/ญ)
                </th>
                <th className="px-4 py-3 text-right font-semibold">ตรวจโรคทั่วไป</th>
                <th className="px-4 py-3 text-right font-semibold">หัตถการ</th>
                <th className="px-4 py-3 text-right font-semibold">รับยาเดิม</th>
                <th className="px-4 py-3 text-right font-semibold">ใบส่งตัว</th>
                <th className="px-4 py-3 text-right font-semibold">Admit / Refer</th>
                <th className="px-4 py-3 font-semibold">โรคอันดับ 1</th>
                <th className="px-4 py-3 font-semibold">อัปเดตล่าสุด</th>
                <th className="px-4 py-3 text-right font-semibold">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    {reports.length === 0 ? (
                      <div className="flex flex-col items-center gap-3">
                        <p>ยังไม่มีข้อมูลรายงาน</p>
                        <button
                          type="button"
                          onClick={openSelectedDate}
                          className="control-button"
                        >
                          เปิดรายงานวันที่เลือก
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <p>ไม่พบรายงานที่ตรงกับคำค้น</p>
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="control-button"
                        >
                          ล้างคำค้น
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((report) => {
                  const topDisease = normalizeTopItems(report.topDiseases)[0];
                  const serviceCell = (male: number, female: number) => (
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                      <span className="font-semibold text-slate-900">{male + female}</span>
                      <span className="ml-1 text-xs text-slate-500">({male}/{female})</span>
                    </td>
                  );
                  return (
                  <tr key={report.reportDate} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">
                        {formatThaiDate(report.reportDate, true)}
                      </span>
                      <span className="ml-2 font-mono text-xs text-slate-500">
                        {report.reportDate}
                      </span>
                    </td>
                    {serviceCell(report.totalMale, report.totalFemale)}
                    {serviceCell(report.thaiMale, report.thaiFemale)}
                    {serviceCell(report.genMale, report.genFemale)}
                    {serviceCell(report.procMale, report.procFemale)}
                    {serviceCell(report.refillMale, report.refillFemale)}
                    {serviceCell(report.referDocMale, report.referDocFemale)}
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                      <span className="font-semibold text-slate-900">Admit {report.admitMale + report.admitFemale}</span>
                      <span className="mx-1 text-slate-400">·</span>
                      <span className="font-semibold text-slate-900">Refer {report.referOutMale + report.referOutFemale}</span>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3">
                      {topDisease ? `${topDisease.name} (${topDisease.count})` : "—"}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {inspect && (
        <Dialog open={Boolean(inspect)} labelledBy="inspect-title" onClose={() => setInspectDate(null)} className="max-w-2xl">
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
                data-dialog-initial-focus
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
                      <span className="text-right font-mono">
                        <span className="block">{item.count}</span>
                        {(item.male !== undefined || item.female !== undefined) && (
                          <span className="block text-xs text-slate-500">
                            ช/ญ {item.male ?? 0}/{item.female ?? 0}
                          </span>
                        )}
                      </span>
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
                        <span className="text-right font-mono">
                          <span className="block">{item.count}</span>
                          {(item.male !== undefined || item.female !== undefined) && (
                            <span className="block text-xs text-slate-500">
                              ช/ญ {item.male ?? 0}/{item.female ?? 0}
                            </span>
                          )}
                        </span>
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
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  const date = inspect.reportDate;
                  setInspectDate(null);
                  onEditDate(date);
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                แก้ไขข้อมูลวันนี้
              </button>
              <button
                type="button"
                onClick={() => setInspectDate(null)}
                className="control-button"
              >
                ปิดหน้าต่าง
              </button>
            </div>
        </Dialog>
      )}
      {deleteDate && isAdmin && (
        <Dialog open labelledBy="delete-title" onClose={() => !deleteBusy && setDeleteDate(null)} className="max-w-sm">
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
                disabled={deleteBusy}
                data-dialog-initial-focus
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void submitDelete()}
                disabled={deleteBusy}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
              >
                {deleteBusy ? "กำลังลบ…" : "ยืนยันลบ"}
              </button>
            </div>
            {deleteError && <p className="mt-3 text-sm text-rose-700" role="alert">{deleteError}</p>}
        </Dialog>
      )}
      {pasteImportOpen && isAdmin && onImportRows && (
        <Dialog
          open
          labelledBy="paste-import-title"
          onClose={() => setPasteImportOpen(false)}
          className="max-w-xl"
        >
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 id="paste-import-title" className="font-display text-lg font-bold text-slate-900">
                วางข้อมูลนำเข้า
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                รองรับ CSV, JSON และ TSV จากไฟล์รายงานที่ส่งออก
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPasteImportOpen(false)}
              className="control-button px-2"
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {pasteImportError && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {pasteImportError}
            </p>
          )}
          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="paste-import-text">
            ข้อมูลรายงาน
            <textarea
              id="paste-import-text"
              value={pasteImportText}
              onChange={(event) => setPasteImportText(event.target.value)}
              rows={9}
              className="control-input mt-2 min-h-48 w-full resize-y font-mono text-xs"
              placeholder="วาง CSV, JSON หรือ TSV ที่ต้องการนำเข้า…"
              data-dialog-initial-focus
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPasteImportOpen(false)} className="control-button">
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submitPasteImport}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              ตรวจสอบข้อมูล
            </button>
          </div>
        </Dialog>
      )}
      {importPreview && (
        <Dialog open labelledBy="import-title" onClose={() => !importBusy && setImportPreview(null)} className="max-w-lg">
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
                disabled={importBusy}
                data-dialog-initial-focus
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
                disabled={importBusy}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void submitImport()}
                disabled={importBusy}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
              >
                {importBusy ? "กำลังนำเข้า…" : "ยืนยันนำเข้า"}
              </button>
            </div>
        </Dialog>
      )}
    </div>
  );
}
