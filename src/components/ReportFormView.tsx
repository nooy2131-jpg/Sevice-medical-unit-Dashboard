import React, { useEffect, useMemo, useState } from 'react';
import { DailyReport, ReportsMap, TopItem, formatThaiDate, normalizeTopItems } from '../types/report';
import { DISEASE_PRESETS, PROCEDURE_PRESETS } from '../data/seedReports';
import {
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';

interface ReportFormViewProps {
  reportsMap: ReportsMap;
  initialDate: string;
  onSave: (report: DailyReport, navigateToDashboard?: boolean) => void;
  onDelete: (dateStr: string) => void;
  onCancel: () => void;
}

const EMPTY_FIVE_ITEMS = (): TopItem[] => [
  { name: '', count: 0, male: 0, female: 0 },
  { name: '', count: 0, male: 0, female: 0 },
  { name: '', count: 0, male: 0, female: 0 },
  { name: '', count: 0, male: 0, female: 0 },
  { name: '', count: 0, male: 0, female: 0 },
];

function padToFive(items: TopItem[]): TopItem[] {
  const normalized = normalizeTopItems(items);
  const result: TopItem[] = [];
  for (let i = 0; i < 5; i++) {
    if (normalized[i]) {
      result.push({
        name: normalized[i].name,
        count: normalized[i].count,
        male: normalized[i].male || 0,
        female: normalized[i].female || 0,
      });
    } else {
      result.push({ name: '', count: 0, male: 0, female: 0 });
    }
  }
  return result;
}

function getCurrentTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export const ReportFormView: React.FC<ReportFormViewProps> = ({
  reportsMap,
  initialDate,
  onSave,
  onDelete,
  onCancel,
}) => {
  const [reportDate, setReportDate] = useState<string>(
    initialDate || new Date().toISOString().slice(0, 10)
  );

  const [autoSumTotal, setAutoSumTotal] = useState<boolean>(true);

  const [numbers, setNumbers] = useState({
    totalMale: 0,
    totalFemale: 0,
    thaiMale: 0,
    thaiFemale: 0,
    genMale: 0,
    genFemale: 0,
    procMale: 0,
    procFemale: 0,
    refillMale: 0,
    refillFemale: 0,
    referDocMale: 0,
    referDocFemale: 0,
    admitMale: 0,
    admitFemale: 0,
    referOutMale: 0,
    referOutFemale: 0,
  });

  const [topDiseases, setTopDiseases] = useState<TopItem[]>(EMPTY_FIVE_ITEMS);
  const [topProcedures, setTopProcedures] = useState<TopItem[]>(EMPTY_FIVE_ITEMS);
  const [reporterNote, setReporterNote] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string>('');

  const savedDatesDesc = useMemo(
    () => Object.keys(reportsMap).sort((a, b) => b.localeCompare(a)),
    [reportsMap]
  );

  const existingRecord = reportsMap[reportDate];

  useEffect(() => {
    if (initialDate) {
      setReportDate(initialDate);
    }
  }, [initialDate]);

  // Load record into form ONLY when switching reportDate
  useEffect(() => {
    setConfirmDelete(false);
    setLastAutoSavedAt('');
    const rec = reportsMap[reportDate];
    if (rec) {
      setNumbers({
        totalMale: Number(rec.totalMale) || 0,
        totalFemale: Number(rec.totalFemale) || 0,
        thaiMale: Number(rec.thaiMale) || 0,
        thaiFemale: Number(rec.thaiFemale) || 0,
        genMale: Number(rec.genMale) || 0,
        genFemale: Number(rec.genFemale) || 0,
        procMale: Number(rec.procMale) || 0,
        procFemale: Number(rec.procFemale) || 0,
        refillMale: Number(rec.refillMale) || 0,
        refillFemale: Number(rec.refillFemale) || 0,
        referDocMale: Number(rec.referDocMale) || 0,
        referDocFemale: Number(rec.referDocFemale) || 0,
        admitMale: Number(rec.admitMale) || 0,
        admitFemale: Number(rec.admitFemale) || 0,
        referOutMale: Number(rec.referOutMale) || 0,
        referOutFemale: Number(rec.referOutFemale) || 0,
      });
      setTopDiseases(padToFive(rec.topDiseases));
      setTopProcedures(padToFive(rec.topProcedures));
      setReporterNote(rec.reporterNote || '');
    } else {
      setNumbers({
        totalMale: 0,
        totalFemale: 0,
        thaiMale: 0,
        thaiFemale: 0,
        genMale: 0,
        genFemale: 0,
        procMale: 0,
        procFemale: 0,
        refillMale: 0,
        refillFemale: 0,
        referDocMale: 0,
        referDocFemale: 0,
        admitMale: 0,
        admitFemale: 0,
        referOutMale: 0,
        referOutFemale: 0,
      });
      setTopDiseases(EMPTY_FIVE_ITEMS());
      setTopProcedures(EMPTY_FIVE_ITEMS());
      setReporterNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate]);

  const buildReportPayload = (
    nextNumbers: typeof numbers,
    nextDiseases: TopItem[],
    nextProcedures: TopItem[],
    nextNote: string,
    sortTopLists = false
  ): DailyReport => {
    const cleanedDiseases = nextDiseases
      .filter((d) => d.name.trim().length > 0)
      .map((d) => ({
        name: d.name.trim(),
        count: Number(d.count) || 0,
        male: d.male || 0,
        female: d.female || 0,
      }));
    if (sortTopLists) {
      cleanedDiseases.sort((a, b) => b.count - a.count);
    }

    const cleanedProcedures = nextProcedures
      .filter((p) => p.name.trim().length > 0)
      .map((p) => ({
        name: p.name.trim(),
        count: Number(p.count) || 0,
        male: p.male || 0,
        female: p.female || 0,
      }));
    if (sortTopLists) {
      cleanedProcedures.sort((a, b) => b.count - a.count);
    }

    const updatedAt = getCurrentTimestamp();
    return {
      reportDate,
      ...nextNumbers,
      topDiseases: cleanedDiseases,
      topProcedures: cleanedProcedures,
      reporterNote: nextNote.trim(),
      updatedAt,
    };
  };

  // Trigger immediate update if editing an existing date or if user modifies data
  const triggerImmediateUpdate = (
    nextNumbers: typeof numbers,
    nextDiseases: TopItem[],
    nextProcedures: TopItem[],
    nextNote: string
  ) => {
    const hasAnyValue =
      Boolean(reportsMap[reportDate]) ||
      Object.values(nextNumbers).some((v) => v > 0) ||
      nextDiseases.some((d) => d.name.trim().length > 0) ||
      nextProcedures.some((p) => p.name.trim().length > 0) ||
      nextNote.trim().length > 0;

    if (hasAnyValue && reportDate) {
      const payload = buildReportPayload(nextNumbers, nextDiseases, nextProcedures, nextNote, false);
      onSave(payload, false);
      setLastAutoSavedAt(payload.updatedAt);
    }
  };

  const shiftDateByDays = (deltaDays: number) => {
    const d = new Date(reportDate + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + deltaDays);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const handleNumberChange = (field: keyof typeof numbers, value: string) => {
    const parsed = Math.max(0, parseInt(value, 10) || 0);
    setNumbers((prev) => {
      const next = { ...prev, [field]: parsed };
      // If autoSumTotal is enabled and the user edited one of the service department fields, automatically recalculate totalMale / totalFemale
      if (autoSumTotal && field !== 'totalMale' && field !== 'totalFemale') {
        next.totalMale =
          next.thaiMale + next.genMale + next.procMale + next.refillMale + next.referDocMale;
        next.totalFemale =
          next.thaiFemale +
          next.genFemale +
          next.procFemale +
          next.refillFemale +
          next.referDocFemale;
      }
      triggerImmediateUpdate(next, topDiseases, topProcedures, reporterNote);
      return next;
    });
  };

  const handleAutoSumFromServices = () => {
    setNumbers((prev) => {
      const sumMale =
        prev.thaiMale + prev.genMale + prev.procMale + prev.refillMale + prev.referDocMale;
      const sumFemale =
        prev.thaiFemale +
        prev.genFemale +
        prev.procFemale +
        prev.refillFemale +
        prev.referDocFemale;
      const next = {
        ...prev,
        totalMale: sumMale,
        totalFemale: sumFemale,
      };
      triggerImmediateUpdate(next, topDiseases, topProcedures, reporterNote);
      return next;
    });
  };

  const handleResetForm = () => {
    const zeroed = {
      totalMale: 0,
      totalFemale: 0,
      thaiMale: 0,
      thaiFemale: 0,
      genMale: 0,
      genFemale: 0,
      procMale: 0,
      procFemale: 0,
      refillMale: 0,
      refillFemale: 0,
      referDocMale: 0,
      referDocFemale: 0,
      admitMale: 0,
      admitFemale: 0,
      referOutMale: 0,
      referOutFemale: 0,
    };
    const emptyDis = EMPTY_FIVE_ITEMS();
    const emptyProc = EMPTY_FIVE_ITEMS();
    setNumbers(zeroed);
    setTopDiseases(emptyDis);
    setTopProcedures(emptyProc);
    setReporterNote('');
    if (reportsMap[reportDate]) {
      triggerImmediateUpdate(zeroed, emptyDis, emptyProc, '');
    }
  };

  const updateTopItem = (
    type: 'disease' | 'procedure',
    index: number,
    key: keyof TopItem,
    val: string | number
  ) => {
    if (type === 'disease') {
      setTopDiseases((prev) => {
        const next = [...prev];
        const item = { ...next[index] };
        if (key === 'name') {
          item.name = String(val);
        } else {
          const num = Math.max(0, Number(val) || 0);
          item[key] = num;
          if (key === 'male' || key === 'female') {
            const m = key === 'male' ? num : item.male || 0;
            const f = key === 'female' ? num : item.female || 0;
            item.count = m + f;
          }
        }
        next[index] = item;
        triggerImmediateUpdate(numbers, next, topProcedures, reporterNote);
        return next;
      });
    } else {
      setTopProcedures((prev) => {
        const next = [...prev];
        const item = { ...next[index] };
        if (key === 'name') {
          item.name = String(val);
        } else {
          const num = Math.max(0, Number(val) || 0);
          item[key] = num;
          if (key === 'male' || key === 'female') {
            const m = key === 'male' ? num : item.male || 0;
            const f = key === 'female' ? num : item.female || 0;
            item.count = m + f;
          }
        }
        next[index] = item;
        triggerImmediateUpdate(numbers, topDiseases, next, reporterNote);
        return next;
      });
    }
  };

  const handleNoteChange = (val: string) => {
    setReporterNote(val);
    triggerImmediateUpdate(numbers, topDiseases, topProcedures, val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDate) return;
    const payload = buildReportPayload(numbers, topDiseases, topProcedures, reporterNote, true);
    onSave(payload, true);
  };

  const metricGroups = [
    {
      title: '1. ผู้รับบริการทั้งหมด',
      subtitle: 'ยอดรวมผู้มารับบริการทั้งหมดประจำวัน (คำนวณอัตโนมัติหรือแก้ไขเองได้)',
      mKey: 'totalMale' as const,
      fKey: 'totalFemale' as const,
    },
    {
      title: '2. ผู้รับบริการแพทย์แผนไทย',
      subtitle: 'ตรวจรักษาแพทย์แผนไทย นวด ประคบ อบสมุนไพร จ่ายยาสมุนไพร',
      mKey: 'thaiMale' as const,
      fKey: 'thaiFemale' as const,
    },
    {
      title: '3. ตรวจโรคทั่วไป (OPD)',
      subtitle: 'ผู้ป่วยนอกตรวจรักษาโรคทั่วไป',
      mKey: 'genMale' as const,
      fKey: 'genFemale' as const,
    },
    {
      title: '4. ทำหัตถการ',
      subtitle: 'ทำแผล ฉีดยา พ่นยา เย็บแผล ตัดไหม',
      mKey: 'procMale' as const,
      fKey: 'procFemale' as const,
    },
    {
      title: '5. รับยาต่อเนื่อง / เติมยาเดิม',
      subtitle: 'คลินิกโรคเรื้อรังและรับยาเดิมตามนัด',
      mKey: 'refillMale' as const,
      fKey: 'refillFemale' as const,
    },
    {
      title: '6. ขอใบส่งตัว',
      subtitle: 'ผู้ป่วยติดต่อขอหนังสือส่งตัวรักษาต่อ',
      mKey: 'referDocMale' as const,
      fKey: 'referDocFemale' as const,
    },
    {
      title: '7. รับไว้รักษาใน รพ. (Admit)',
      subtitle: 'ผู้ป่วยรับไว้เป็นผู้ป่วยในของโรงพยาบาล',
      mKey: 'admitMale' as const,
      fKey: 'admitFemale' as const,
    },
    {
      title: '8. ส่งต่อรักษาที่อื่น (Refer Out)',
      subtitle: 'ส่งตัวฉุกเฉินหรือส่งต่อไปโรงพยาบาลอื่น',
      mKey: 'referOutMale' as const,
      fKey: 'referOutFemale' as const,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>หน่วยบริการชั่วคราว โรงพยาบาลองครักษ์</span>
            <span aria-hidden="true">·</span>
            <span>
              {existingRecord
                ? `กำลังแก้ไขข้อมูลของวันที่ ${formatThaiDate(reportDate, true)}`
                : `สร้างรายงานใหม่สำหรับวันที่ ${formatThaiDate(reportDate, true)}`}
            </span>
            {(lastAutoSavedAt || existingRecord?.updatedAt) && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-teal-700 font-medium tabular-nums">
                  <RefreshCw className="w-3 h-3" />
                  อัปเดตล่าสุด: {lastAutoSavedAt || existingRecord?.updatedAt}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            บันทึกข้อมูลประจำวัน / แก้ไขข้อมูลย้อนหลัง
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            ล้างตัวเลขเป็น 0
          </button>
        </div>
      </div>

      {/* Historical Date Selection & Navigation Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <History className="w-4 h-4 text-teal-600" />
              <span>เลือกวันที่ต้องการบันทึก หรือแก้ไขข้อมูลย้อนหลัง</span>
            </div>
            <p className="text-xs text-slate-500">
              ทุกครั้งที่มีการแก้ไขตัวเลขหรือข้อความ ระบบจะอัปเดตข้อมูลและคำนวณสถิติใหม่ให้อัตโนมัติทันที
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => shiftDateByDays(-1)}
              title="ย้อนกลับ 1 วัน"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              วันก่อนหน้า
            </button>

            <input
              id="report-date-input"
              type="date"
              required
              aria-label="วันที่รายงาน"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-sm font-mono font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />

            <button
              type="button"
              onClick={() => shiftDateByDays(1)}
              title="ถัดไป 1 วัน"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              วันถัดไป
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Saved Historical Dates Quick Selector */}
        {savedDatesDesc.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label htmlFor="saved-dates-select" className="text-xs font-medium text-slate-600">
              ดึงข้อมูลจากวันที่เคยบันทึกไว้แล้ว ({savedDatesDesc.length} วัน):
            </label>
            <select
              id="saved-dates-select"
              value={existingRecord ? reportDate : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setReportDate(e.target.value);
                }
              }}
              className="border border-slate-300 bg-slate-50 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 tabular-nums sm:w-80"
            >
              <option value="">-- คลิกเลือกวันที่เคยบันทึกเพื่อแก้ไขย้อนหลัง --</option>
              {savedDatesDesc.map((d) => {
                const r = reportsMap[d];
                const tot = (Number(r?.totalMale) || 0) + (Number(r?.totalFemale) || 0);
                return (
                  <option key={d} value={d}>
                    {d} ({formatThaiDate(d, true)}) — รวม {tot} ราย
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Quick Helper Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoSumTotal}
            onChange={(e) => setAutoSumTotal(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
          />
          <span>
            <strong className="text-slate-900">อัปเดตยอดรวมผู้รับบริการทั้งหมดอัตโนมัติ</strong>{' '}
            เมื่อแก้ไขตัวเลขในแผนกบริการ (ข้อ 2–6)
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoSumFromServices}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap"
          >
            <Calculator className="w-3.5 h-3.5" />
            คำนวณรวมยอดข้อ 2–6 ทันที
          </button>
        </div>
      </div>

      {/* 8 Metric Pairs Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">
          ส่วนที่ 1: จำนวนผู้รับบริการแยกตามประเภทและเพศ
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 mt-5">
          {metricGroups.map((group) => {
            const mVal = numbers[group.mKey];
            const fVal = numbers[group.fKey];
            const sumVal = mVal + fVal;

            return (
              <div
                key={group.title}
                className="pb-4 border-b border-slate-100 last:border-b-0 md:nth-last-2:border-b-0 flex flex-col justify-between gap-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{group.title}</div>
                    <div className="text-xs text-slate-500">{group.subtitle}</div>
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums shrink-0">
                    รวม <strong className="text-slate-900 text-sm">{sumVal}</strong> ราย
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">ชาย (Male)</label>
                    <input
                      type="number"
                      min={0}
                      value={mVal}
                      onChange={(e) => handleNumberChange(group.mKey, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">หญิง (Female)</label>
                    <input
                      type="number"
                      min={0}
                      value={fVal}
                      onChange={(e) => handleNumberChange(group.fKey, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 5 Diseases & Top 5 Procedures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Diseases */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              ส่วนที่ 2: 5 อันดับโรคที่พบบ่อย
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              พิมพ์ชื่อโรคหรือคลิกเลือกจากรายการโรคที่พบบ่อย พร้อมระบุจำนวนผู้ป่วย
            </p>
          </div>

          <datalist id="disease-presets-list">
            {DISEASE_PRESETS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>

          <div className="mt-4 space-y-3">
            {topDiseases.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <span className="col-span-1 text-xs font-mono text-slate-500 tabular-nums">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  list="disease-presets-list"
                  placeholder={`ชื่อโรคอันดับที่ ${idx + 1}...`}
                  value={item.name}
                  onChange={(e) => updateTopItem('disease', idx, 'name', e.target.value)}
                  className="col-span-6 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="ชาย"
                  title="จำนวนผู้ป่วยชาย"
                  value={item.male || ''}
                  onChange={(e) => updateTopItem('disease', idx, 'male', e.target.value)}
                  className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="หญิง"
                  title="จำนวนผู้ป่วยหญิง"
                  value={item.female || ''}
                  onChange={(e) => updateTopItem('disease', idx, 'female', e.target.value)}
                  className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="รวม"
                  title="จำนวนรวม"
                  value={item.count || ''}
                  onChange={(e) => updateTopItem('disease', idx, 'count', e.target.value)}
                  className="col-span-1 border border-slate-300 bg-slate-50 rounded-lg px-1.5 py-1.5 text-xs font-mono font-semibold tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            หมายเหตุ: ช่องตัวเลข 3 ช่องหลัง คือ ชาย · หญิง · รวม (หากกรอก ชาย/หญิง ระบบจะบวกช่องรวมให้อัตโนมัติ หรือกรอกช่องรวมโดยตรงก็ได้)
          </div>
        </div>

        {/* Top 5 Procedures */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              ส่วนที่ 3: 5 อันดับหัตถการ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              พิมพ์ชื่อหัตถการหรือคลิกเลือกจากรายการมาตรฐาน พร้อมระบุจำนวนครั้ง
            </p>
          </div>

          <datalist id="procedure-presets-list">
            {PROCEDURE_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <div className="mt-4 space-y-3">
            {topProcedures.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <span className="col-span-1 text-xs font-mono text-slate-500 tabular-nums">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  list="procedure-presets-list"
                  placeholder={`ชื่อหัตถการอันดับที่ ${idx + 1}...`}
                  value={item.name}
                  onChange={(e) => updateTopItem('procedure', idx, 'name', e.target.value)}
                  className="col-span-6 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="ชาย"
                  title="จำนวนผู้ป่วยชาย"
                  value={item.male || ''}
                  onChange={(e) => updateTopItem('procedure', idx, 'male', e.target.value)}
                  className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="หญิง"
                  title="จำนวนผู้ป่วยหญิง"
                  value={item.female || ''}
                  onChange={(e) => updateTopItem('procedure', idx, 'female', e.target.value)}
                  className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="รวม"
                  title="จำนวนรวม"
                  value={item.count || ''}
                  onChange={(e) => updateTopItem('procedure', idx, 'count', e.target.value)}
                  className="col-span-1 border border-slate-300 bg-slate-50 rounded-lg px-1.5 py-1.5 text-xs font-mono font-semibold tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            หมายเหตุ: ระบบจะเรียงลำดับจากจำนวนมากไปน้อยให้อัตโนมัติเมื่อกดยืนยันบันทึกข้อมูล
          </div>
        </div>
      </div>

      {/* Reporter Note & Submit */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <label htmlFor="reporter-note" className="block text-sm font-bold text-slate-900 mb-1">
            ส่วนที่ 4: หมายเหตุเพิ่มเติม
          </label>
          <textarea
            id="reporter-note"
            rows={3}
            placeholder="ระบุรายละเอียดเพิ่มเติม เช่น สภาพความหนาแน่นของผู้รับบริการ การส่งต่อผู้ป่วยฉุกเฉิน หรือปัญหาที่พบในเวร..."
            value={reporterNote}
            onChange={(e) => handleNoteChange(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            {existingRecord && (
              <>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    ลบข้อมูลของวันที่ {reportDate}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 font-medium">ยืนยันการลบข้อมูลวันนี้?</span>
                    <button
                      type="button"
                      onClick={() => onDelete(reportDate)}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700"
                    >
                      ยืนยันลบ
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ดูผลลัพธ์ในหน้าภาพรวม
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              {existingRecord ? 'ยืนยันการอัปเดตข้อมูลและกลับหน้าภาพรวม' : 'บันทึกข้อมูลรายงานประจำวัน'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
