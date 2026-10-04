/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { DailyReport, ReportsMap } from './types/report';
import { INITIAL_REPORTS_DATA } from './data/seedReports';
import { DashboardView } from './components/DashboardView';
import { ReportFormView } from './components/ReportFormView';
import { RecordsTableView } from './components/RecordsTableView';
import { GasSetupView } from './components/GasSetupView';

const STORAGE_KEY = 'ongkharak_hospital_reports_v1';

type ActiveTab = 'dashboard' | 'form' | 'table' | 'gas';

export default function App() {
  const [reportsMap, setReportsMap] = useState<ReportsMap>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to initial seed data
    }
    return INITIAL_REPORTS_DATA;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [editingDate, setEditingDate] = useState<string>('2026-10-03');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reportsMap));
    } catch {
      // Ignore storage errors
    }
  }, [reportsMap]);

  const showToast = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const reportsList = useMemo(() => Object.values(reportsMap), [reportsMap]);

  const handleSaveReport = (report: DailyReport) => {
    const isUpdate = Boolean(reportsMap[report.reportDate]);
    setReportsMap((prev) => ({
      ...prev,
      [report.reportDate]: report,
    }));
    showToast(
      isUpdate
        ? `อัปเดตข้อมูลรายงานประจำวันที่ ${report.reportDate} เรียบร้อยแล้ว`
        : `บันทึกข้อมูลรายงานประจำวันที่ ${report.reportDate} เรียบร้อยแล้ว`
    );
    setActiveTab('dashboard');
  };

  const handleDeleteReport = (dateStr: string) => {
    setReportsMap((prev) => {
      const next = { ...prev };
      delete next[dateStr];
      return next;
    });
    showToast(`ลบข้อมูลรายงานของวันที่ ${dateStr} ออกจากระบบแล้ว`);
    if (activeTab === 'form') {
      setActiveTab('dashboard');
    }
  };

  const handleEditDate = (dateStr: string) => {
    setEditingDate(dateStr);
    setActiveTab('form');
  };

  const handleNewReport = () => {
    const dates = Object.keys(reportsMap).sort();
    if (dates.length > 0) {
      const last = dates[dates.length - 1];
      const d = new Date(last + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1);
        setEditingDate(d.toISOString().slice(0, 10));
      } else {
        setEditingDate(new Date().toISOString().slice(0, 10));
      }
    } else {
      setEditingDate(new Date().toISOString().slice(0, 10));
    }
    setActiveTab('form');
  };

  const handleExportCsv = () => {
    const headers = [
      'ReportDate',
      'TotalMale',
      'TotalFemale',
      'ThaiMale',
      'ThaiFemale',
      'GenMale',
      'GenFemale',
      'ProcMale',
      'ProcFemale',
      'RefillMale',
      'RefillFemale',
      'ReferDocMale',
      'ReferDocFemale',
      'AdmitMale',
      'AdmitFemale',
      'ReferOutMale',
      'ReferOutFemale',
      'TopDiseasesJson',
      'TopProceduresJson',
      'ReporterNote',
      'UpdatedAt',
    ];

    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const sorted = [...reportsList].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
    const rows = sorted.map((r) =>
      [
        r.reportDate,
        r.totalMale,
        r.totalFemale,
        r.thaiMale,
        r.thaiFemale,
        r.genMale,
        r.genFemale,
        r.procMale,
        r.procFemale,
        r.refillMale,
        r.refillFemale,
        r.referDocMale,
        r.referDocFemale,
        r.admitMale,
        r.admitFemale,
        r.referOutMale,
        r.referOutFemale,
        JSON.stringify(r.topDiseases || []),
        JSON.stringify(r.topProcedures || []),
        r.reporterNote || '',
        r.updatedAt || '',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DailyReports_Ongkharak_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('ส่งออกไฟล์ CSV (21 คอลัมน์ สำหรับ Google Sheet DailyReports) เรียบร้อยแล้ว');
  };

  const handleImportReports = (imported: DailyReport[]) => {
    setReportsMap((prev) => {
      const next = { ...prev };
      for (const item of imported) {
        if (item.reportDate) {
          next[item.reportDate] = item;
        }
      }
      return next;
    });
    showToast(`นำเข้าข้อมูลสำเร็จจำนวน ${imported.length} วันทำการ`);
  };

  const handleResetToSeed = () => {
    setReportsMap(INITIAL_REPORTS_DATA);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REPORTS_DATA));
    showToast('รีเซ็ตเป็นชุดข้อมูลตัวอย่างของหน่วยบริการชั่วคราว รพ.องครักษ์ เรียบร้อยแล้ว');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Strictly 1 row, 3 zones */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap"
        >
          รพ.องครักษ์ · หน่วยบริการชั่วคราว
        </a>

        {/* Zone 2: 4 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'text-teal-700 font-semibold underline underline-offset-8 decoration-2 decoration-teal-600'
                : 'hover:text-slate-900'
            }`}
          >
            ภาพรวมสถิติ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'form'
                ? 'text-teal-700 font-semibold underline underline-offset-8 decoration-2 decoration-teal-600'
                : 'hover:text-slate-900'
            }`}
          >
            บันทึกข้อมูลประจำวัน
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'table'
                ? 'text-teal-700 font-semibold underline underline-offset-8 decoration-2 decoration-teal-600'
                : 'hover:text-slate-900'
            }`}
          >
            ตารางข้อมูลย้อนหลัง
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gas')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'gas'
                ? 'text-teal-700 font-semibold underline underline-offset-8 decoration-2 decoration-teal-600'
                : 'hover:text-slate-900'
            }`}
          >
            โค้ดตั้งค่า Google Sheet
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="hidden sm:inline-flex px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            ส่งออก CSV
          </button>
          <button
            type="button"
            onClick={handleNewReport}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            + บันทึกรายงานวันนี้
          </button>
        </div>
      </header>

      {/* Mobile Secondary Navigation Bar (only on small screens) */}
      <div className="flex md:hidden items-center justify-around bg-white border-b border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 no-print overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap ${
            activeTab === 'dashboard' ? 'bg-teal-50 text-teal-700 font-semibold' : ''
          }`}
        >
          ภาพรวมสถิติ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap ${
            activeTab === 'form' ? 'bg-teal-50 text-teal-700 font-semibold' : ''
          }`}
        >
          บันทึกข้อมูล
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('table')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap ${
            activeTab === 'table' ? 'bg-teal-50 text-teal-700 font-semibold' : ''
          }`}
        >
          ตารางย้อนหลัง
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gas')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap ${
            activeTab === 'gas' ? 'bg-teal-50 text-teal-700 font-semibold' : ''
          }`}
        >
          โค้ด GAS
        </button>
      </div>

      {/* Main Content Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        {statusMessage && (
          <div
            role="status"
            className={`mb-6 px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between no-print ${
              statusMessage.isError
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-teal-50 border-teal-200 text-teal-900'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-500 hover:text-slate-800 ml-4"
            >
              ปิด
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            reports={reportsList}
            onEditDate={handleEditDate}
            onNewReport={handleNewReport}
          />
        )}

        {activeTab === 'form' && (
          <ReportFormView
            reportsMap={reportsMap}
            initialDate={editingDate}
            onSave={handleSaveReport}
            onDelete={handleDeleteReport}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'table' && (
          <RecordsTableView
            reports={reportsList}
            onEditDate={handleEditDate}
            onDeleteDate={handleDeleteReport}
            onExportCsv={handleExportCsv}
            onImportReports={handleImportReports}
            onResetToSeed={handleResetToSeed}
          />
        )}

        {activeTab === 'gas' && <GasSetupView />}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ระบบสารสนเทศรายงานสถิติผู้รับบริการ หน่วยบริการชั่วคราว โรงพยาบาลองครักษ์ จังหวัดนครนายก</span>
          <span className="tabular-nums">รองรับโครงสร้างตาราง DailyReports (21 คอลัมน์)</span>
        </div>
      </footer>
    </div>
  );
}
