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
import { isCalendarDate, todayBangkok } from "../lib/dates";
import { validateReport } from "../lib/report-validation";

type UserRole = "admin" | "member";

type PendingDraftRecord = {
  data: DailyReport;
  expectedVersion: number;
  draftRevision: number;
};

function pendingDraftKey(userId: string, date: string): string {
  return `report-draft:${encodeURIComponent(userId)}:${date}`;
}

function comparableDraft(value: DailyReport): string {
  try {
    return JSON.stringify(validateReport(value));
  } catch {
    return JSON.stringify(value);
  }
}

function sameDraftValue(left: DailyReport | null | undefined, right: DailyReport | null | undefined): boolean {
  return Boolean(left && right && comparableDraft(left) === comparableDraft(right));
}

function readPendingDraft(userId: string, date: string): { record: PendingDraftRecord | null; unavailable: boolean } {
  try {
    const raw = window.sessionStorage.getItem(pendingDraftKey(userId, date));
    if (!raw) return { record: null, unavailable: false };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { record: null, unavailable: false };
    const candidate = parsed as Record<string, unknown>;
    const expectedVersion = candidate.expectedVersion;
    const draftRevision = candidate.draftRevision;
    if (typeof expectedVersion !== "number" || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || typeof draftRevision !== "number" || !Number.isSafeInteger(draftRevision) || draftRevision < 0 || typeof candidate.data !== "object" || candidate.data === null || Array.isArray(candidate.data)) {
      return { record: null, unavailable: false };
    }
    const data = validateReport(candidate.data);
    if (data.reportDate !== date) return { record: null, unavailable: false };
    return {
      record: {
        data: candidate.data as DailyReport,
        expectedVersion,
        draftRevision,
      },
      unavailable: false,
    };
  } catch {
    return { record: null, unavailable: true };
  }
}

function writePendingDraft(userId: string, date: string, record: PendingDraftRecord): boolean {
  try {
    window.sessionStorage.setItem(pendingDraftKey(userId, date), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function clearPendingDraft(userId: string, date: string): boolean {
  try {
    window.sessionStorage.removeItem(pendingDraftKey(userId, date));
    return true;
  } catch {
    return false;
  }
}

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
      onPeriodChange={(date) => {
        if (isCalendarDate(date)) setPeriodEndDate(date);
      }}
      onEditDate={(date) => {
        router.push(`/reports/${date}`);
      }}
      onNewReport={(date) => {
        router.push(`/reports/${date ?? todayBangkok()}`);
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
      const message = "ไม่พบเวอร์ชันล่าสุดของรายงาน กรุณาโหลดข้อมูลใหม่";
      throw new Error(message);
    }
    const response = await fetch(`/api/reports/${date}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: selected.version }),
    });
    if (!response.ok) {
      const payload = await readJson(response);
      const message = getError(payload, "ลบรายงานไม่สำเร็จ");
      throw new Error(message);
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
      const message = getError(payload, "นำเข้ารายงานไม่สำเร็จ");
      throw new Error(message);
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
  userId,
}: {
  initialDate: string;
  role: UserRole;
  userId: string;
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
  const [pendingRecovery, setPendingRecovery] = useState<PendingDraftRecord | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [verifiedConflictVersion, setVerifiedConflictVersion] = useState<number | null>(null);
  const [verifiedDraftRevision, setVerifiedDraftRevision] = useState<number | null>(null);
  const draftBaseVersion = useRef(0);
  const draftRevision = useRef(0);
  const latestDraft = useRef<DailyReport | null>(null);
  const latestDraftValue = useRef<DailyReport | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromise = useRef<Promise<void> | null>(null);
  const loadedKey = useRef<string>("");
  const navigationInProgress = useRef(false);

  const loadDate = useCallback(async (date: string) => {
    const key = `${date}:${Date.now()}`;
    loadedKey.current = key;
    setLoadState("loading");
    setError(null);
    setConflict(null);
    setPendingRecovery(null);
    setStorageWarning(null);
    setVerifiedConflictVersion(null);
    setVerifiedDraftRevision(null);
    setPublished(null);
    setDraft(null);
    latestDraft.current = null;
    latestDraftValue.current = null;
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
      const pendingResult = readPendingDraft(userId, date);
      if (pendingResult.unavailable) {
        setStorageWarning("ไม่สามารถเก็บฉบับร่างสำรองใน session นี้ได้ กรุณาอย่าปิดหน้าต่างจนกว่าจะบันทึกฉบับร่างสำเร็จ");
      }
      const pending = pendingResult.record;
      if (pending && !sameDraftValue(pending.data, draftValue)) {
        setPendingRecovery(pending);
      } else if (pending && draftValue && sameDraftValue(pending.data, draftValue)) {
        // The server returned the exact normalized value, so this is an
        // acknowledgement of the pending local copy.
        clearPendingDraft(userId, date);
      }
      setDraft(draftValue ?? null);
      // A loaded draft is already persisted. Only schedule edits and explicit
      // recovery actions in latestDraft so a no-op navigation does not bump its
      // revision or create a false cross-tab conflict.
      latestDraft.current = null;
      latestDraftValue.current = draftValue ?? null;
      setLoadState("idle");
      setDraftState(draftValue ? "saved" : "idle");
    } catch (reason) {
      if (loadedKey.current !== key) return;
      setLoadState("error");
      setError(
        reason instanceof Error ? reason.message : "ไม่สามารถโหลดรายงานได้",
      );
    }
  }, [userId]);
  useEffect(() => {
    void loadDate(reportDate);
  }, [loadDate, reportDate]);

  const persistLatestDraft = useCallback(async (baseVersionOverride?: number) => {
    if (savePromise.current) return savePromise.current;
    const run = (async () => {
      try {
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
              expectedVersion: baseVersionOverride ?? draftBaseVersion.current,
              expectedDraftRevision,
            }),
          });
          const payload = await readJson(response);
          if (!response.ok) {
            if (response.status === 409) {
              let serverRevision: number | null = null;
              try {
                const currentResponse = await fetch(`/api/drafts/${value.reportDate}`, { cache: "no-store" });
                const currentPayload = await readJson(currentResponse);
                const currentDraft = currentPayload.draft as { revision?: unknown } | null | undefined;
                if (currentResponse.ok && typeof currentDraft?.revision === "number") {
                  serverRevision = currentDraft.revision;
                } else if (currentResponse.status === 404 || currentPayload.draft === null) {
                  serverRevision = 0;
                }
              } catch {
                // Keep the local draft and require another explicit retry if the
                // conflict snapshot cannot be read.
              }
              setVerifiedConflictVersion(null);
              setVerifiedDraftRevision(serverRevision);
              setDraftState("conflict");
              setError(getError(payload, "ฉบับร่างถูกแก้ไขในอีกแท็บหนึ่ง"));
              setConflict(
                serverRevision === null
                  ? "ฉบับร่างถูกแก้ไขในอีกแท็บหนึ่ง แต่ยังอ่านเวอร์ชันล่าสุดไม่ได้ กรุณาลองใหม่"
                  : "ฉบับร่างถูกแก้ไขในอีกแท็บหนึ่ง ข้อมูลของคุณยังอยู่ ตรวจสอบแล้วเลือกว่าจะใช้ฉบับร่างนี้แทนหรือไม่",
              );
              setDraftState("conflict");
            } else {
              setDraftState("error");
            }
            setError(getError(payload, "บันทึกฉบับร่างไม่สำเร็จ"));
            throw new Error(getError(payload, "บันทึกฉบับร่างไม่สำเร็จ"));
          }
          const savedDraft = payload.draft as { revision?: unknown; data?: unknown } | undefined;
          if (typeof savedDraft?.revision === "number")
            draftRevision.current = savedDraft.revision;
          if (baseVersionOverride !== undefined)
            draftBaseVersion.current = baseVersionOverride;
          if (latestDraft.current === value) {
            const acknowledged = sameDraftValue(
              savedDraft?.data as DailyReport | undefined,
              value,
            );
            if (acknowledged && clearPendingDraft(userId, value.reportDate)) {
              setStorageWarning(null);
            }
            latestDraft.current = null;
            setDraftState("saved");
          }
        }
      } catch (reason) {
        setDraftState("error");
        setError(
          reason instanceof Error ? reason.message : "บันทึกฉบับร่างไม่สำเร็จ",
        );
        throw reason;
      }
    })();
    savePromise.current = run.finally(() => {
      savePromise.current = null;
    });
    return savePromise.current;
  }, [userId]);
  const scheduleDraft = (value: DailyReport) => {
    if (!draft && !latestDraft.current)
      draftBaseVersion.current = published?.version ?? 0;
    latestDraft.current = value;
    latestDraftValue.current = value;
    setDraft(value);
    setDraftState("saving");
    const stored = writePendingDraft(userId, value.reportDate, {
      data: value,
      expectedVersion: draftBaseVersion.current,
      draftRevision: draftRevision.current,
    });
    if (!stored) {
      setStorageWarning("ไม่สามารถเก็บฉบับร่างสำรองใน session นี้ได้ กรุณาอย่าปิดหน้าต่างจนกว่าจะบันทึกฉบับร่างสำเร็จ");
    } else {
      setStorageWarning(null);
    }
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void persistLatestDraft().catch(() => undefined);
    }, 650);
  };
  const flushDraft = useCallback(async () => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
    }
    if (savePromise.current) await savePromise.current;
    // A failed timer flush leaves latestDraft intact. Every subsequent
    // navigation/save attempt must retry that value instead of assuming the
    // timer's attempt was successful.
    if (latestDraft.current) await persistLatestDraft();
  }, [persistLatestDraft]);
  useEffect(
    () => () => {
      void flushDraft().catch(() => undefined);
    },
    [flushDraft],
  );
  useEffect(() => {
    const guardPendingNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      if (!latestDraft.current && !savePromise.current) return;
      event.preventDefault();
      if (navigationInProgress.current) return;
      navigationInProgress.current = true;
      void flushDraft()
        .then(() => {
          router.push(`${destination.pathname}${destination.search}${destination.hash}`);
        })
        .catch(() => {
          navigationInProgress.current = false;
        });
    };
    document.addEventListener("click", guardPendingNavigation, true);
    return () => document.removeEventListener("click", guardPendingNavigation, true);
  }, [flushDraft, router]);
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
        try {
          const currentResponse = await fetch(`/api/reports/${report.reportDate}`, { cache: "no-store" });
          const currentPayload = await readJson(currentResponse);
          if (currentResponse.ok && currentPayload.report) {
            current = currentPayload.report as DailyReport;
          } else if (currentResponse.status === 404) {
            setVerifiedConflictVersion(0);
          } else {
            setVerifiedConflictVersion(null);
          }
        } catch {
          setVerifiedConflictVersion(null);
        }
      }
      setPublished(current ?? null);
      if (current) setVerifiedConflictVersion(current.version ?? null);
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
    try {
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
        if (sameDraftValue(latestDraftValue.current, report) && clearPendingDraft(userId, report.reportDate)) {
          setStorageWarning(null);
        }
        latestDraftValue.current = null;
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
    } catch {
      setPublishError("รายงานเผยแพร่แล้ว แต่ไม่สามารถล้างฉบับร่างได้");
    } finally {
      setPublishing(false);
    }
  };
  const rebaseDraft = async () => {
    const currentVersion = verifiedConflictVersion;
    const currentDraftRevision = verifiedDraftRevision;
    if (currentVersion === null && currentDraftRevision === null) return;
    try {
      if (currentDraftRevision !== null) {
        const pendingSave = savePromise.current;
        if (pendingSave) {
          try {
            await pendingSave;
          } catch {
            // A stale in-flight save is expected to fail before this explicit
            // rebase can use the verified server revision.
          }
        }
        const value = latestDraftValue.current ?? latestDraft.current ?? draft;
        if (!value) return;
        latestDraft.current = value;
        // The server revision was fetched after the 409. Keep the local value,
        // but use that revision as the explicit CAS point for this overwrite.
        draftRevision.current = currentDraftRevision;
        await persistLatestDraft();
      } else {
        // Finish any ordinary autosave first. Then queue the retained local
        // value and retry it against the verified published version.
        await flushDraft();
        const value = latestDraftValue.current ?? latestDraft.current ?? draft;
        if (!value) return;
        latestDraft.current = value;
        await persistLatestDraft(currentVersion ?? undefined);
      }
      setConflict(null);
      setVerifiedConflictVersion(null);
      setVerifiedDraftRevision(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ปรับฐานฉบับร่างไม่สำเร็จ");
    }
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
    if (!isCalendarDate(date)) {
      setError("กรุณาระบุวันที่ตามปฏิทินที่ถูกต้อง");
      return;
    }
    try {
      await flushDraft();
      setReportDate(date);
      window.history.replaceState(null, "", `/reports/${date}`);
    } catch {
      // flushDraft already leaves the draft and exposes the save error.
    }
  };
  const leaveToDashboard = async () => {
    try {
      await flushDraft();
      router.push("/dashboard");
    } catch {
      // Keep the editor open so the user can retry the preserved draft.
    }
  };
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!latestDraft.current && !savePromise.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, []);
  const recoverPendingDraft = () => {
    if (!pendingRecovery) return;
    const recovery = pendingRecovery;
    draftBaseVersion.current = recovery.expectedVersion;
    latestDraft.current = recovery.data;
    latestDraftValue.current = recovery.data;
    setDraft(recovery.data);
    setPendingRecovery(null);
    scheduleDraft(recovery.data);
  };
  const useServerDraft = () => {
    if (!pendingRecovery) return;
    clearPendingDraft(userId, reportDate);
    setPendingRecovery(null);
    latestDraft.current = null;
    latestDraftValue.current = draft;
  };
  const draftSummary = (value: DailyReport | null): string => {
    if (!value) return "ยังไม่มีฉบับร่างบน server";
    const total = value.totalMale + value.totalFemale;
    return `${total.toLocaleString("th-TH")} ราย · ${value.reporterNote.trim() || "ไม่มีหมายเหตุ"}`;
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
    <>
      {storageWarning && (
        <div className="mx-auto mb-4 max-w-6xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          {storageWarning}
        </div>
      )}
      {pendingRecovery && (
        <div className="mx-auto mb-4 max-w-6xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p>พบฉบับร่างที่ยังไม่ได้รับการยืนยันจาก session ก่อนหน้า เลือกว่าจะกู้ฉบับร่างของคุณหรือใช้ข้อมูลจาก server</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <p>ฉบับร่างของคุณ: <strong>{draftSummary(pendingRecovery.data)}</strong></p>
            <p>ข้อมูลบน server: <strong>{draftSummary(draft ?? published)}</strong></p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={recoverPendingDraft} className="min-h-11 rounded-lg bg-amber-800 px-4 py-2 text-xs font-semibold text-white">กู้ฉบับร่างของฉัน</button>
            <button type="button" onClick={useServerDraft} className="min-h-11 rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900">ใช้ข้อมูลจาก server</button>
          </div>
        </div>
      )}
      {pendingRecovery === null && <ReportFormView
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
      onRebase={verifiedConflictVersion === null && verifiedDraftRevision === null ? undefined : rebaseDraft}
      rebaseLabel={
        verifiedDraftRevision !== null
          ? "ใช้ฉบับร่างนี้แทนข้อมูลจากแท็บอื่น"
          : verifiedConflictVersion === 0
            ? "กู้ฉบับร่างเป็นรายงานใหม่"
            : undefined
      }
      />}
    </>
  );
}
