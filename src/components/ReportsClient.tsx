'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardView } from './DashboardView';
import { ReportFormView } from './ReportFormView';
import { RecordsTableView } from './RecordsTableView';
import { DailyReport, ReportDraftResponse, ReportSaveState } from '../types/report';

type UserRole = 'admin' | 'member';

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => ({}));
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function getError(payload: Record<string, unknown>, fallback: string): string {
  return typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : fallback;
}

export function ReportsDashboardClient({ initialDate, role }: { initialDate: string; role: UserRole }) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [periodEndDate, setPeriodEndDate] = useState(initialDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadReports = useCallback(async () => {
    setLoading(true); setError(null);
    try { const response = await fetch('/api/reports', { cache: 'no-store' }); const payload = await readJson(response); if (!response.ok) throw new Error(getError(payload, 'ไม่สามารถโหลดรายงานได้')); setReports(Array.isArray(payload.reports) ? payload.reports as DailyReport[] : []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดรายงานได้'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadReports(); }, [loadReports]);
  if (loading) return <div className="mx-auto max-w-7xl rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">กำลังโหลดรายงาน…</div>;
  if (error) return <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800" role="alert"><p>{error}</p><button type="button" onClick={() => void loadReports()} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white">ลองใหม่</button></div>;
  return <DashboardView reports={reports} periodEndDate={periodEndDate} onPeriodChange={setPeriodEndDate} onEditDate={(date) => { window.location.href = `/reports/${date}`; }} onNewReport={(date) => { window.location.href = `/reports/${date ?? periodEndDate}`; }} />;
}

export function ReportsRecordsClient({ role }: { role: UserRole }) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadReports = useCallback(async () => { setLoading(true); setError(null); try { const response = await fetch('/api/reports', { cache: 'no-store' }); const payload = await readJson(response); if (!response.ok) throw new Error(getError(payload, 'ไม่สามารถโหลดรายงานได้')); setReports(Array.isArray(payload.reports) ? payload.reports as DailyReport[] : []); } catch (reason) { setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดรายงานได้'); } finally { setLoading(false); } }, []);
  useEffect(() => { void loadReports(); }, [loadReports]);
  const exportCsv = async () => { const response = await fetch('/api/reports?format=csv'); if (!response.ok) { setError('ส่งออก CSV ไม่สำเร็จ'); return; } const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `daily-reports-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); };
  const deleteReport = async (date: string) => { const response = await fetch(`/api/reports/${date}`, { method: 'DELETE' }); if (!response.ok) { const payload = await readJson(response); setError(getError(payload, 'ลบรายงานไม่สำเร็จ')); return; } setReports((previous) => previous.filter((report) => report.reportDate !== date)); };
  const importText = async (text: string, duplicateMode: 'skip' | 'overwrite') => { const response = await fetch('/api/reports/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: text, duplicateMode }) }); const payload = await readJson(response); if (!response.ok) { setError(getError(payload, 'นำเข้ารายงานไม่สำเร็จ')); return; } await loadReports(); };
  if (loading) return <div className="mx-auto max-w-7xl rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">กำลังโหลดรายงาน…</div>;
  if (error) return <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800" role="alert"><p>{error}</p><button type="button" onClick={() => void loadReports()} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white">ลองใหม่</button></div>;
  return <RecordsTableView reports={reports} isAdmin={role === 'admin'} onEditDate={(date) => { window.location.href = `/reports/${date}`; }} onDeleteDate={deleteReport} onExportCsv={exportCsv} onImportText={role === 'admin' ? importText : undefined} />;
}

export function ReportEditorClient({ initialDate, role }: { initialDate: string; role: UserRole }) {
  const [reportDate, setReportDate] = useState(initialDate);
  const [published, setPublished] = useState<DailyReport | null>(null);
  const [draft, setDraft] = useState<DailyReport | null>(null);
  const [loadState, setLoadState] = useState<ReportSaveState>('loading');
  const [draftState, setDraftState] = useState<ReportSaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const latestDraft = useRef<DailyReport | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromise = useRef<Promise<void> | null>(null);
  const loadedKey = useRef<string>('');

  const loadDate = useCallback(async (date: string) => {
    const key = `${date}:${Date.now()}`; loadedKey.current = key; setLoadState('loading'); setError(null); setConflict(null); setPublished(null); setDraft(null); latestDraft.current = null;
    try {
      const draftResponse = await fetch(`/api/drafts/${date}`, { cache: 'no-store' });
      const draftPayload = await readJson(draftResponse) as ReportDraftResponse;
      const draftValue = (draftPayload.draft ?? draftPayload.data) as DailyReport | null | undefined;
      const reportResponse = await fetch('/api/reports', { cache: 'no-store' });
      const reportPayload = await readJson(reportResponse);
      if (!reportResponse.ok) throw new Error(getError(reportPayload, 'ไม่สามารถโหลดรายงานได้'));
      const found = Array.isArray(reportPayload.reports) ? (reportPayload.reports as DailyReport[]).find((report) => report.reportDate === date) ?? null : null;
      if (loadedKey.current !== key) return;
      setPublished(found); setDraft(draftValue ?? null); latestDraft.current = draftValue ?? null; setLoadState('idle'); setDraftState(draftValue ? 'saved' : 'idle');
    } catch (reason) { if (loadedKey.current !== key) return; setLoadState('error'); setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดรายงานได้'); }
  }, []);
  useEffect(() => { void loadDate(reportDate); }, [loadDate, reportDate]);

  const persistDraft = useCallback(async (value: DailyReport | null) => {
    if (!value) return;
    setDraftState('saving'); setError(null);
    const response = await fetch(`/api/drafts/${value.reportDate}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: value, expectedVersion: published?.version ?? null }) });
    const payload = await readJson(response);
    if (!response.ok) { setDraftState('error'); setError(getError(payload, 'บันทึกฉบับร่างไม่สำเร็จ')); throw new Error(getError(payload, 'บันทึกฉบับร่างไม่สำเร็จ')); }
    setDraftState('saved');
  }, [published?.version]);
  const scheduleDraft = (value: DailyReport) => { latestDraft.current = value; setDraft(value); setDraftState('saving'); if (draftTimer.current) clearTimeout(draftTimer.current); draftTimer.current = setTimeout(() => { const pending = latestDraft.current; savePromise.current = persistDraft(pending).finally(() => { savePromise.current = null; }); }, 650); };
  const flushDraft = useCallback(async () => { if (draftTimer.current) { clearTimeout(draftTimer.current); draftTimer.current = null; const pending = latestDraft.current; savePromise.current = persistDraft(pending).finally(() => { savePromise.current = null; }); } if (savePromise.current) await savePromise.current; }, [persistDraft]);
  const savePublished = async (report: DailyReport) => { await flushDraft(); setLoadState('loading'); setError(null); const response = await fetch(`/api/reports/${report.reportDate}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report, expectedVersion: published?.version ?? null }) }); const payload = await readJson(response); if (response.status === 409) { const current = payload.currentReport as DailyReport | undefined; if (current) setPublished(current); setLoadState('idle'); setConflict('รายงานนี้ถูกแก้ไขโดยผู้ใช้อื่นแล้ว ฉบับร่างของคุณยังอยู่ กรุณาตรวจสอบข้อมูลปัจจุบันก่อนบันทึกอีกครั้ง'); return; } if (!response.ok) { setLoadState('error'); setError(getError(payload, 'บันทึกรายงานไม่สำเร็จ')); return; } const saved = (payload.report ?? report) as DailyReport; setPublished(saved); setDraft(null); latestDraft.current = null; setDraftState('idle'); setLoadState('idle'); setConflict(null); await fetch(`/api/drafts/${report.reportDate}`, { method: 'DELETE' }); };
  const deletePublished = async (date: string) => { const response = await fetch(`/api/reports/${date}`, { method: 'DELETE' }); const payload = await readJson(response); if (!response.ok) { setError(getError(payload, 'ลบรายงานไม่สำเร็จ')); return; } window.location.href = '/records'; };
  const moveDate = async (date: string) => { await flushDraft(); setReportDate(date); window.history.replaceState(null, '', `/reports/${date}`); };
  if (loadState === 'loading') return <div className="mx-auto max-w-6xl rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">กำลังโหลดรายงานและฉบับร่าง…</div>;
  if (loadState === 'error' && !published && !draft) return <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800" role="alert"><p>{error ?? 'ไม่สามารถโหลดข้อมูลได้'}</p><button type="button" onClick={() => void loadDate(reportDate)} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white">ลองใหม่</button></div>;
  return <ReportFormView reportDate={reportDate} publishedReport={published} draft={draft} canDelete={role === 'admin'} saveState={draftState} errorMessage={error} conflictMessage={conflict} onDateChange={(date) => void moveDate(date)} onSave={savePublished} onDelete={role === 'admin' ? deletePublished : undefined} onCancel={() => { void moveDate(reportDate); }} onDraftChange={scheduleDraft} onDraftFlush={flushDraft} />;
}
