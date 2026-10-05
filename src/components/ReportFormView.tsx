"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { DISEASE_PRESETS, PROCEDURE_PRESETS } from "../data/seedReports";
import { isCalendarDate, shiftDate } from "../lib/dates";
import {
  DailyReport,
  ReportSaveState,
  TopItem,
  formatBangkokTimestamp,
  formatThaiDate,
  normalizeTopItems,
} from "../types/report";

type NumberField =
  | "totalMale"
  | "totalFemale"
  | "thaiMale"
  | "thaiFemale"
  | "genMale"
  | "genFemale"
  | "procMale"
  | "procFemale"
  | "refillMale"
  | "refillFemale"
  | "referDocMale"
  | "referDocFemale"
  | "admitMale"
  | "admitFemale"
  | "referOutMale"
  | "referOutFemale";
type NumberValues = Record<NumberField, number>;

export interface ReportFormViewProps {
  reportDate: string;
  publishedReport?: DailyReport | null;
  draft?: DailyReport | null;
  canDelete?: boolean;
  saveState?: ReportSaveState;
  errorMessage?: string | null;
  publishErrorMessage?: string | null;
  isPublishing?: boolean;
  conflictMessage?: string | null;
  disabled?: boolean;
  onDateChange?: (date: string) => void;
  onSave: (report: DailyReport) => Promise<void>;
  onDelete?: (date: string) => Promise<void>;
  onCancel?: () => void;
  onDraftChange?: (report: DailyReport) => void;
  onDraftFlush?: () => Promise<void>;
  onRebase?: () => Promise<void>;
  rebaseLabel?: string;
}

const numberFields: NumberField[] = [
  "totalMale",
  "totalFemale",
  "thaiMale",
  "thaiFemale",
  "genMale",
  "genFemale",
  "procMale",
  "procFemale",
  "refillMale",
  "refillFemale",
  "referDocMale",
  "referDocFemale",
  "admitMale",
  "admitFemale",
  "referOutMale",
  "referOutFemale",
];
const EMPTY_NUMBERS: NumberValues = Object.fromEntries(
  numberFields.map((key) => [key, 0]),
) as NumberValues;
const metricGroups: Array<{
  title: string;
  subtitle: string;
  mKey: NumberField;
  fKey: NumberField;
}> = [
  {
    title: "ผู้รับบริการทั้งหมด",
    subtitle: "ยอดรวมผู้มารับบริการทั้งหมดประจำวัน",
    mKey: "totalMale",
    fKey: "totalFemale",
  },
  {
    title: "แพทย์แผนไทย",
    subtitle: "ตรวจรักษา นวด ประคบ อบสมุนไพร และจ่ายยาสมุนไพร",
    mKey: "thaiMale",
    fKey: "thaiFemale",
  },
  {
    title: "ตรวจโรคทั่วไป (OPD)",
    subtitle: "ผู้ป่วยนอกตรวจรักษาโรคทั่วไป",
    mKey: "genMale",
    fKey: "genFemale",
  },
  {
    title: "ทำหัตถการ",
    subtitle: "ทำแผล ฉีดยา พ่นยา เย็บแผล และตัดไหม",
    mKey: "procMale",
    fKey: "procFemale",
  },
  {
    title: "รับยาต่อเนื่อง / เติมยาเดิม",
    subtitle: "คลินิกโรคเรื้อรังและรับยาเดิมตามนัด",
    mKey: "refillMale",
    fKey: "refillFemale",
  },
  {
    title: "ขอใบส่งตัว",
    subtitle: "ผู้ป่วยติดต่อขอหนังสือส่งตัวรักษาต่อ",
    mKey: "referDocMale",
    fKey: "referDocFemale",
  },
  {
    title: "รับไว้รักษาใน รพ. (Admit)",
    subtitle: "ผู้ป่วยรับไว้เป็นผู้ป่วยในของโรงพยาบาล",
    mKey: "admitMale",
    fKey: "admitFemale",
  },
  {
    title: "ส่งต่อรักษาที่อื่น (Refer Out)",
    subtitle: "ส่งตัวฉุกเฉินหรือส่งต่อไปโรงพยาบาลอื่น",
    mKey: "referOutMale",
    fKey: "referOutFemale",
  },
];
const emptyItems = (): TopItem[] =>
  Array.from({ length: 5 }, () => ({ name: "", count: 0, male: 0, female: 0 }));

function valuesFromReport(report?: DailyReport | null): NumberValues {
  return numberFields.reduce(
    (values, key) => {
      values[key] = Number(report?.[key]) || 0;
      return values;
    },
    { ...EMPTY_NUMBERS },
  );
}

function itemsFromReport(items?: TopItem[]): TopItem[] {
  const normalized = normalizeTopItems(items ?? []);
  return Array.from(
    { length: 5 },
    (_, index) =>
      normalized[index] ?? { name: "", count: 0, male: 0, female: 0 },
  );
}

function makeReport(
  reportDate: string,
  numbers: NumberValues,
  diseases: TopItem[],
  procedures: TopItem[],
  note: string,
  version?: number,
): DailyReport {
  const clean = (items: TopItem[]) =>
    items
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        count: Math.max(0, Number(item.count) || 0),
        male: Math.max(0, Number(item.male) || 0),
        female: Math.max(0, Number(item.female) || 0),
      }))
      .sort((a, b) => b.count - a.count);
  return {
    reportDate,
    ...numbers,
    topDiseases: clean(diseases),
    topProcedures: clean(procedures),
    reporterNote: note.trim(),
    updatedAt: new Date().toISOString(),
    version,
  };
}

function statusCopy(
  state: ReportSaveState | undefined,
  error?: string | null,
): string {
  if (state === "loading") return "กำลังโหลดข้อมูล…";
  if (state === "saving") return "กำลังบันทึกฉบับร่าง…";
  if (state === "saved") return "บันทึกฉบับร่างแล้ว";
  if (state === "conflict") return "ข้อมูลเผยแพร่มีการเปลี่ยนแปลง";
  if (state === "error") return error || "บันทึกฉบับร่างไม่สำเร็จ";
  return "ฉบับร่างยังไม่เผยแพร่";
}

export function ReportFormView({
  reportDate,
  publishedReport,
  draft,
  canDelete = false,
  saveState = "idle",
  errorMessage,
  publishErrorMessage,
  isPublishing = false,
  conflictMessage,
  disabled = false,
  onDateChange,
  onSave,
  onDelete,
  onCancel,
  onDraftChange,
  onDraftFlush,
  onRebase,
  rebaseLabel = "ใช้เวอร์ชันปัจจุบันเป็นฐาน แล้วบันทึกฉบับร่างใหม่",
}: ReportFormViewProps) {
  const source = draft ?? publishedReport;
  const [numbers, setNumbers] = useState<NumberValues>(() =>
    valuesFromReport(source),
  );
  const [diseases, setDiseases] = useState<TopItem[]>(() =>
    itemsFromReport(source?.topDiseases),
  );
  const [procedures, setProcedures] = useState<TopItem[]>(() =>
    itemsFromReport(source?.topProcedures),
  );
  const [note, setNote] = useState(source?.reporterNote ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const draftGeneration = useRef(0);
  const hydratedKey = useRef<string | null>(null);

  useEffect(() => {
    const nextSource = draft ?? publishedReport;
    const sourceKey = `${reportDate}:${publishedReport?.version ?? "new"}:${draft ? "draft" : "published"}`;
    if (hydratedKey.current === sourceKey) return;
    hydratedKey.current = sourceKey;
    setNumbers(valuesFromReport(nextSource));
    setDiseases(itemsFromReport(nextSource?.topDiseases));
    setProcedures(itemsFromReport(nextSource?.topProcedures));
    setNote(nextSource?.reporterNote ?? "");
    setConfirmDelete(false);
    draftGeneration.current += 1;
  }, [reportDate, draft, publishedReport]);

  const emitDraft = (
    nextNumbers: NumberValues,
    nextDiseases: TopItem[],
    nextProcedures: TopItem[],
    nextNote: string,
  ) => {
    draftGeneration.current += 1;
    onDraftChange?.(
      makeReport(
        reportDate,
        nextNumbers,
        nextDiseases,
        nextProcedures,
        nextNote,
        publishedReport?.version,
      ),
    );
  };
  const updateNumber = (field: NumberField, raw: string) => {
    const parsed = raw === "" ? 0 : Math.max(0, Math.floor(Number(raw)) || 0);
    setNumbers((previous) => {
      const next = { ...previous, [field]: parsed };
      emitDraft(next, diseases, procedures, note);
      return next;
    });
  };
  const updateItem = (
    kind: "disease" | "procedure",
    index: number,
    key: keyof TopItem,
    value: string,
  ) => {
    const setter = kind === "disease" ? setDiseases : setProcedures;
    setter((previous) => {
      const next = previous.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (key === "name") return { ...item, name: value };
        const numeric = Math.max(0, Math.floor(Number(value)) || 0);
        const updated = { ...item, [key]: numeric };
        if (key === "male" || key === "female") {
          updated.count = (updated.male ?? 0) + (updated.female ?? 0);
        }
        return updated;
      });
      emitDraft(
        numbers,
        kind === "disease" ? next : diseases,
        kind === "procedure" ? next : procedures,
        note,
      );
      return next;
    });
  };
  const resetDraft = () => {
    const diseasesNext = emptyItems();
    const proceduresNext = emptyItems();
    const numbersNext = { ...EMPTY_NUMBERS };
    setNumbers(numbersNext);
    setDiseases(diseasesNext);
    setProcedures(proceduresNext);
    setNote("");
    emitDraft(numbersNext, diseasesNext, proceduresNext, "");
  };
  const moveDateByDays = async (delta: number) => {
    try {
      await onDraftFlush?.();
      onDateChange?.(shiftDate(reportDate, delta));
    } catch {
      // The parent keeps the draft and exposes the save error in its status.
    }
  };
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onDraftFlush?.();
      await onSave(
        makeReport(
          reportDate,
          numbers,
          diseases,
          procedures,
          note,
          publishedReport?.version,
        ),
      );
    } catch {
      // The parent owns the visible error state and retains the local draft.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const statusTone =
    saveState === "error" || saveState === "conflict"
      ? "text-rose-700 bg-rose-50 border-rose-200"
      : saveState === "saved"
        ? "text-teal-800 bg-teal-50 border-teal-200"
        : "text-slate-600 bg-slate-50 border-slate-200";

  return (
    <form onSubmit={handleSubmit} aria-busy={isPublishing || submitting} className="mx-auto max-w-6xl space-y-5 pb-10">
      <fieldset disabled={disabled || isPublishing || submitting} className="contents">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            หน่วยบริการชั่วคราว โรงพยาบาลองครักษ์ ·{" "}
            {publishedReport
              ? `แก้ไขข้อมูลของวันที่ ${formatThaiDate(reportDate, true)}`
              : `สร้างรายงานใหม่สำหรับวันที่ ${formatThaiDate(reportDate, true)}`}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">
            บันทึกข้อมูลรายงานประจำวัน
          </h1>
          <p className="mt-2 text-xs text-slate-600">
            {publishedReport
              ? `เผยแพร่แล้ว · เวอร์ชัน ${publishedReport.version ?? "—"} · อัปเดต ${formatBangkokTimestamp(publishedReport.updatedAt)}`
              : "ยังไม่มีรายงานที่เผยแพร่สำหรับวันนี้"}
          </p>
        </div>
        <div
          className={`max-w-full rounded-lg border px-3 py-2 text-sm font-medium leading-5 ${statusTone}`}
          aria-live="polite"
        >
          {statusCopy(saveState, errorMessage)}
        </div>
      </div>
      {conflictMessage && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p>{conflictMessage}</p>
          {onRebase && (
            <button
              type="button"
              onClick={() => void onRebase()}
              className="control-button mt-3 border-amber-300 bg-white text-sm text-amber-900 hover:bg-amber-100"
            >
              {rebaseLabel}
            </button>
          )}
        </div>
      )}
      {publishErrorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          บันทึกรายงานที่เผยแพร่ไม่สำเร็จ: {publishErrorMessage}
        </div>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              วันที่รายงาน
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              ฉบับร่างจะถูกเก็บแยกจากรายงานที่เผยแพร่
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void moveDateByDays(-1)}
              className="control-button"
              aria-label="วันก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
              ก่อนหน้า
            </button>
            <label htmlFor="report-date" className="sr-only">
              วันที่รายงาน
            </label>
            <input
              id="report-date"
              type="date"
              value={reportDate}
              onChange={async (event) => {
                const nextDate = event.target.value;
                if (!isCalendarDate(nextDate)) return;
                try {
                  await onDraftFlush?.();
                  onDateChange?.(nextDate);
                } catch {
                  // The parent keeps the draft and exposes the save error in its status.
                }
              }}
              className="control-input font-mono tabular-nums"
              required
            />
            <button
              type="button"
              onClick={() => void moveDateByDays(1)}
              className="control-button"
              aria-label="วันถัดไป"
            >
              ถัดไป
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-bold text-slate-900">
            ส่วนที่ 1: จำนวนผู้รับบริการแยกตามประเภทและเพศ
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            ยอดชายและหญิงกรอกแยกกันได้ หมวดบริการอาจนับซ้ำกันได้
            ยอดรวมจะไม่ถูกคำนวณแทน
          </p>
        </div>
        <div className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {metricGroups.map((group, index) => {
            const total = numbers[group.mKey] + numbers[group.fKey];
            return (
              <div
                key={group.title}
                className="border-b border-slate-100 pb-5 md:[&:nth-last-child(-n+2)]:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {index + 1}. {group.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {group.subtitle}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-500">
                    ชาย+หญิง{" "}
                    <strong className="font-mono text-slate-900">
                      {total}
                    </strong>
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="field-label">
                    ชาย (Male)
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={numbers[group.mKey] || ""}
                      onChange={(event) =>
                        updateNumber(group.mKey, event.target.value)
                      }
                      className="control-input mt-1 w-full min-w-0 font-mono tabular-nums"
                    />
                  </label>
                  <label className="field-label">
                    หญิง (Female)
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={numbers[group.fKey] || ""}
                      onChange={(event) =>
                        updateNumber(group.fKey, event.target.value)
                      }
                      className="control-input mt-1 w-full min-w-0 font-mono tabular-nums"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        {(
          [
            ["โรคที่พบบ่อย 5 อันดับ", diseases, "disease", DISEASE_PRESETS],
            ["หัตถการ 5 อันดับ", procedures, "procedure", PROCEDURE_PRESETS],
          ] as const
        ).map(([title, items, kind, presets]) => (
          <section
            key={title}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-display text-base font-bold text-slate-900">
                ส่วนที่ {kind === "disease" ? 2 : 3}: {title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                กรอกจำนวนชายและหญิงได้แยกกัน
              </p>
            </div>
            <datalist id={`${kind}-presets`}>
              {presets.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>
            <div className="mt-4 space-y-3">
              {items.map((item, index) => (
                <div
                  key={`${kind}-${index}`}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_4rem_4rem_4rem] sm:items-end"
                >
                  <span className="pb-2 font-mono text-xs text-slate-500">
                    #{index + 1}
                  </span>
                  <label className="field-label col-start-2 sm:col-auto">
                    ชื่อ{kind === "disease" ? "โรค" : "หัตถการ"}
                    <input
                      type="text"
                      list={`${kind}-presets`}
                      value={item.name}
                      onChange={(event) =>
                        updateItem(kind, index, "name", event.target.value)
                      }
                      className="control-input mt-1 w-full text-sm"
                    />
                  </label>
                  <label className="field-label col-start-2 sm:col-auto">
                    ชาย
                    <input
                      type="number"
                      min="0"
                      value={item.male || ""}
                      onChange={(event) =>
                        updateItem(kind, index, "male", event.target.value)
                      }
                      className="control-input mt-1 w-full min-w-0 font-mono"
                    />
                  </label>
                  <label className="field-label col-start-2 sm:col-auto">
                    หญิง
                    <input
                      type="number"
                      min="0"
                      value={item.female || ""}
                      onChange={(event) =>
                        updateItem(kind, index, "female", event.target.value)
                      }
                      className="control-input mt-1 w-full min-w-0 font-mono"
                    />
                  </label>
                  <label className="field-label col-start-2 sm:col-auto">
                    รวม
                    <input
                      type="number"
                      min="0"
                      value={item.count || ""}
                      onChange={(event) =>
                        updateItem(kind, index, "count", event.target.value)
                      }
                      className="control-input mt-1 w-full min-w-0 bg-slate-50 font-mono"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <label
          htmlFor="reporter-note"
          className="field-label text-sm font-semibold text-slate-900"
        >
          ส่วนที่ 4: หมายเหตุภาพรวม
          <textarea
            id="reporter-note"
            rows={4}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              emitDraft(numbers, diseases, procedures, event.target.value);
            }}
            placeholder="บันทึกข้อสังเกตภาพรวม เช่น ความหนาแน่น การส่งต่อฉุกเฉิน หรือปัญหาที่พบในเวร (ไม่ระบุชื่อหรือข้อมูลผู้ป่วย)"
            className="control-input mt-2 min-h-28 w-full resize-y text-sm"
          />
        </label>
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {canDelete &&
              publishedReport &&
              onDelete &&
              (!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  ลบรายงานวันนี้
                </button>
              ) : (
                <span className="flex flex-wrap items-center gap-2 text-sm text-rose-700">
                  <span>ยืนยันการลบรายงานนี้?</span>
                  <button
                    type="button"
                    onClick={() => void onDelete(reportDate)}
                    className="inline-flex min-h-11 items-center rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    ยืนยันลบ
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    ยกเลิก
                  </button>
                </span>
              ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={async () => {
                try {
                  await onDraftFlush?.();
                  onCancel?.();
                } catch {
                  // The parent keeps the draft and exposes the save error in its status.
                }
              }}
              className="control-button justify-center"
            >
              กลับภาพรวม (เก็บฉบับร่าง)
            </button>
            <button
              type="button"
              onClick={resetDraft}
              className="control-button justify-center"
            >
              <RotateCcw className="h-4 w-4" />
              ล้างฉบับร่าง
            </button>
            <button
              type="submit"
              disabled={
                isPublishing ||
                submitting ||
                saveState === "saving" ||
                saveState === "loading"
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {isPublishing || submitting ? "กำลังบันทึก…" : "บันทึกรายงานที่เผยแพร่"}
            </button>
          </div>
        </div>
      </section>
      </fieldset>
    </form>
  );
}
