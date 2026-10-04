"use client";
/* Network loading effects intentionally synchronize remote data into local state. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardView } from "./DashboardView";
import { ReportFormView } from "./ReportFormView";
import { RecordsTableView } from "./RecordsTableView";
import {
  DailyReport,
  ReportDraftResponse,
  ReportSaveState,
} from "../types/report";
import { exportReportsCsv } from "../lib/csv";

type UserRole = "admin" | "member";

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => ({}));
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function getError(payload: Record<string, unknown>, fallback: string): string {
  if (typeof payload.error === "string") return payload.error;
  if (
    payload.error &&
    typeof payload.error === "object" &&
    !Array.isArray(payload.error)
  ) {
    const error = payload.error as Record<string, unknown>;
    if (typeof error.message === "string") return error.message;
  }
  return typeof payload.message === "string" ? payload.message : fallback;
}

export function ReportsDashboardClient({
  initialDate,
}: {
  initialDate: string;
}) {
  const router = useRouter();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [periodEndDate, setPeriodEndDate] = useState(initialDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok)
        throw new Error(getError(payload, "ไม่สามารถโหลดรายงานได้"));
      setReports(
        Array.isArray(payload.reports)
          ? (payload.reports as DailyReport[])
          : [],
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ไม่สามารถโหลดรายงานได้",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadReports();
  }, [loadReports]);
  if (loading)
    return (
      <div className="mx-auto max-w-7xl rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        กำลังโหลดรายงาน…
      </div>
    );
  if (error)
    return (
      <div
        className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"
        role="alert"
      >
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void loadReports()}
          className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white"
        >
          ลองใหม่
        </button>
      </div>
    );
  return (
    <DashboardView
      reports={reports}
      periodEndDate={periodEndDate}
      onPeriodChange={setPeriodEndDate}
      onEditDate={(date) => {
        router.push(`/reports/${date}`);
      }}
      onNewReport={(date) => {
        router.push(`/reports/${date ?? periodEndDate}`);
      }}
    />
  );
}

export function ReportsRecordsClient({ role }: { role: UserRole }) {
  const router = useRouter();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok)
        throw new Error(getError(payload, "ไม่สามารถโหลดรายงานได้"));
      setReports(
        Array.isArray(payload.reports)
          ? (payload.reports as DailyReport[])
          : [],
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ไม่สามารถโหลดรายงานได้",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadReports();
  }, [loadReports]);
  const exportCsv = () => {
    const csv = exportReportsCsv(reports);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const deleteReport = async (date: string) => {
    const selected = reports.find((report) => report.reportDate === date);
    if (selected?.version === undefined) {
      setError("ไม่พบเวอร์ชันล่าสุดของรายงาน กรุณาโหลดข้อมูลใหม่");
      return;
    }
    const response = await fetch(`/api/reports/${date}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: selected.version }),
    });
    if (!response.ok) {
      const payload = await readJson(response);
      setError(getError(payload, "ลบรายงานไม่สำเร็จ"));
      return;
    }
    setReports((previous) =>
      previous.filter((report) => report.reportDate !== date),
    );
  };
  const importRows = async (
    rows: DailyReport[],
    duplicateMode: "skip" | "overwrite",
    expectedVersions: Record<string, number>,
  ) => {
    const response = await fetch("/api/reports/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reports: rows,
        mode: duplicateMode,
        expectedVersions,
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(getError(payload, "นำเข้ารายงานไม่สำเร็จ"));
      return;
    }
    await loadReports();
  };
  if (loading)
    return (
      <div className="mx-auto max-w-7xl rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        กำลังโหลดรายงาน…
      </div>
    );
  if (error)
    return (
      <div
        className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"
        role="alert"
      >
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void loadReports()}
          className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white"
        >
          ลองใหม่
        </button>
      </div>
    );
  return (
    <RecordsTableView
      reports={reports}
      isAdmin={role === "admin"}
      onEditDate={(date) => {
        router.push(`/reports/${date}`);
      }}
      onDeleteDate={deleteReport}
      onExportCsv={exportCsv}
      onImportRows={role === "admin" ? importRows : undefined}
    />
  );
}

export function ReportEditorClient({
  initialDate,
  role,
}: {
  initialDate: string;
  role: UserRole;
}) {
  const router = useRouter();
  const [reportDate, setReportDate] = useState(initialDate);
  const [published, setPublished] = useState<DailyReport | null>(null);
  const [draft, setDraft] = useState<DailyReport | null>(null);
  const [loadState, setLoadState] = useState<ReportSaveState>("loading");
  const [draftState, setDraftState] = useState<ReportSaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const draftBaseVersion = useRef(0);
  const draftRevision = useRef(0);
  const latestDraft = useRef<DailyReport | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromise = useRef<Promise<void> | null>(null);
  const loadedKey = useRef<string>("");

  const loadDate = useCallback(async (date: string) => {
    const key = `${date}:${Date.now()}`;
    loadedKey.current = key;
    setLoadState("loading");
    setError(null);
    setConflict(null);
    setPublished(null);
    setDraft(null);
    latestDraft.current = null;
    try {
      const draftResponse = await fetch(`/api/drafts/${date}`, {
        cache: "no-store",
      });
      if (!draftResponse.ok && draftResponse.status !== 404) {
        const draftError = await readJson(draftResponse);
        throw new Error(getError(draftError, "ไม่สามารถโหลดฉบับร่างได้"));
      }
      const draftPayload = (await readJson(
        draftResponse,
      )) as ReportDraftResponse;
      const draftRecord = draftPayload.draft;
      const draftValue = draftRecord?.data ?? null;
      const reportResponse = await fetch("/api/reports", { cache: "no-store" });
      const reportPayload = await readJson(reportResponse);
      if (!reportResponse.ok)
        throw new Error(getError(reportPayload, "ไม่สามารถโหลดรายงานได้"));
      const found = Array.isArray(reportPayload.reports)
        ? ((reportPayload.reports as DailyReport[]).find(
            (report) => report.reportDate === date,
          ) ?? null)
        : null;
      if (loadedKey.current !== key) return;
      draftBaseVersion.current =
        draftRecord?.expectedVersion ?? found?.version ?? 0;
      draftRevision.current = draftRecord?.revision ?? 0;
      setPublished(found);
      setDraft(draftValue ?? null);
      latestDraft.current = draftValue ?? null;
      setLoadState("idle");
      setDraftState(draftValue ? "saved" : "idle");
    } catch (reason) {
      if (loadedKey.current !== key) return;
      setLoadState("error");
      setError(
        reason instanceof Error ? reason.message : "ไม่สามารถโหลดรายงานได้",
      );
    }
  }, []);
  useEffect(() => {
    void loadDate(reportDate);
  }, [loadDate, reportDate]);

  const persistLatestDraft = useCallback(async () => {
    if (savePromise.current) return savePromise.current;
    const run = (async () => {
      while (latestDraft.current) {
        const value = latestDraft.current;
        const expectedDraftRevision = draftRevision.current;
        setDraftState("saving");
        setError(null);
        const response = await fetch(`/api/drafts/${value.reportDate}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: value,
            expectedVersion: draftBaseVersion.current,
            expectedDraftRevision,
          }),
        });
        const payload = await readJson(response);
        if (!response.ok) {
          setDraftState("error");
          setError(getError(payload, "บันทึกฉบับร่างไม่สำเร็จ"));
          throw new Error(getError(payload, "บันทึกฉบับร่างไม่สำเร็จ"));
        }
        const savedDraft = payload.draft as { revision?: unknown } | undefined;
        if (typeof savedDraft?.revision === "number")
          draftRevision.current = savedDraft.revision;
        if (latestDraft.current === value) {
          latestDraft.current = null;
          setDraftState("saved");
        }
      }
    })();
    savePromise.current = run.finally(() => {
      savePromise.current = null;
    });
    return savePromise.current;
  }, []);
  const scheduleDraft = (value: DailyReport) => {
    if (!draft && !latestDraft.current)
      draftBaseVersion.current = published?.version ?? 0;
    latestDraft.current = value;
    setDraft(value);
    setDraftState("saving");
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void persistLatestDraft();
    }, 650);
  };
  const flushDraft = useCallback(async () => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
      void persistLatestDraft();
    }
    if (savePromise.current) await savePromise.current;
  }, [persistLatestDraft]);
  useEffect(
    () => () => {
      void flushDraft();
    },
    [flushDraft],
  );
  const savePublished = async (report: DailyReport) => {
    try {
      await flushDraft();
    } catch (reason) {
      setPublishError(
        reason instanceof Error ? reason.message : "บันทึกฉบับร่างไม่สำเร็จ",
      );
      return;
    }
    // A recovered draft is based on the published version that was present
    // when it was saved. Keep that CAS value until the user reviews a conflict.
    const expectedVersion = draftBaseVersion.current;
    const savedDraftRevision = draftRevision.current;
    setPublishing(true);
    setPublishError(null);
    setError(null);
    let response: Response;
    try {
      response = await fetch(`/api/reports/${report.reportDate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, expectedVersion }),
      });
    } catch (reason) {
      setPublishing(false);
      setPublishError(
        reason instanceof Error ? reason.message : "บันทึกรายงานไม่สำเร็จ",
      );
      return;
    }
    const payload = await readJson(response);
    if (response.status === 409) {
      let current = (payload.currentReport ?? payload.report) as
        DailyReport | undefined;
      if (!current) {
        const currentResponse = await fetch(
          `/api/reports/${report.reportDate}`,
          {
            cache: "no-store",
          },
        );
        const currentPayload = await readJson(currentResponse);
        if (currentResponse.ok && currentPayload.report) {
          current = currentPayload.report as DailyReport;
        }
      }
      if (current) setPublished(current);
      setPublishing(false);
      setConflict(
        "รายงานนี้ถูกแก้ไขโดยผู้ใช้อื่นแล้ว ฉบับร่างของคุณยังอยู่ กรุณาตรวจสอบข้อมูลปัจจุบันก่อนบันทึกอีกครั้ง",
      );
      return;
    }
    if (!response.ok) {
      setPublishing(false);
      setPublishError(getError(payload, "บันทึกรายงานไม่สำเร็จ"));
      return;
    }
    const saved = (payload.report ?? report) as DailyReport;
    setPublished(saved);
    setConflict(null);
    const deleteDraftResponse = await fetch(
      `/api/drafts/${report.reportDate}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedDraftRevision: savedDraftRevision }),
      },
    );
    if (deleteDraftResponse.ok) {
      draftBaseVersion.current = saved.version ?? 0;
      setDraft(null);
      latestDraft.current = null;
      draftRevision.current = 0;
      setDraftState("idle");
    } else {
      const deletePayload = await readJson(deleteDraftResponse);
      setPublishError(
        getError(
          deletePayload,
          "รายงานเผยแพร่แล้ว แต่ไม่สามารถล้างฉบับร่างได้",
        ),
      );
    }
    setPublishing(false);
  };
  const deletePublished = async (date: string) => {
    const expectedVersion = published?.version ?? 0;
    const response = await fetch(`/api/reports/${date}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      setError(getError(payload, "ลบรายงานไม่สำเร็จ"));
      return;
    }
    router.push("/records");
  };
  const moveDate = async (date: string) => {
    await flushDraft();
    setReportDate(date);
    window.history.replaceState(null, "", `/reports/${date}`);
  };
  const leaveToDashboard = async () => {
    await flushDraft();
    router.push("/dashboard");
  };
  if (loadState === "loading")
    return (
      <div className="mx-auto max-w-6xl rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        กำลังโหลดรายงานและฉบับร่าง…
      </div>
    );
  if (loadState === "error" && !published && !draft)
    return (
      <div
        className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"
        role="alert"
      >
        <p>{error ?? "ไม่สามารถโหลดข้อมูลได้"}</p>
        <button
          type="button"
          onClick={() => void loadDate(reportDate)}
          className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white"
        >
          ลองใหม่
        </button>
      </div>
    );
  return (
    <ReportFormView
      reportDate={reportDate}
      publishedReport={published}
      draft={draft}
      canDelete={role === "admin"}
      saveState={draftState}
      errorMessage={error}
      publishErrorMessage={publishError}
      isPublishing={publishing}
      conflictMessage={conflict}
      onDateChange={(date) => void moveDate(date)}
      onSave={savePublished}
      onDelete={role === "admin" ? deletePublished : undefined}
      onCancel={() => {
        void leaveToDashboard();
      }}
      onDraftChange={scheduleDraft}
      onDraftFlush={flushDraft}
    />
  );
}
