import React, { useMemo, useState } from 'react';
import { DailyReport, formatThaiDate, normalizeTopItems } from '../types/report';
import { Printer, Plus, Calendar, ArrowUpRight } from 'lucide-react';

interface DashboardViewProps {
  reports: DailyReport[];
  onEditDate: (dateStr: string) => void;
  onNewReport: () => void;
}

type RangeMode = 'ALL' | '7D' | 'MONTH' | 'SINGLE';

export const DashboardView: React.FC<DashboardViewProps> = ({
  reports,
  onEditDate,
  onNewReport,
}) => {
  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => a.reportDate.localeCompare(b.reportDate)),
    [reports]
  );

  const latestDate = sortedReports.length > 0 ? sortedReports[sortedReports.length - 1].reportDate : '';
  const [rangeMode, setRangeMode] = useState<RangeMode>('ALL');
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(latestDate);

  const activeSingleDate = selectedSingleDate && reports.some((r) => r.reportDate === selectedSingleDate)
    ? selectedSingleDate
    : latestDate;

  const filteredReports = useMemo(() => {
    if (sortedReports.length === 0) return [];
    if (rangeMode === 'SINGLE') {
      return sortedReports.filter((r) => r.reportDate === activeSingleDate);
    }
    if (rangeMode === '7D') {
      return sortedReports.slice(-7);
    }
    if (rangeMode === 'MONTH') {
      const targetMonth = latestDate.slice(0, 7);
      return sortedReports.filter((r) => r.reportDate.startsWith(targetMonth));
    }
    return sortedReports;
  }, [sortedReports, rangeMode, activeSingleDate, latestDate]);

  const stats = useMemo(() => {
    const acc = {
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

    const diseaseMap = new Map<string, { count: number; male: number; female: number }>();
    const procedureMap = new Map<string, { count: number; male: number; female: number }>();

    for (const r of filteredReports) {
      acc.totalMale += Number(r.totalMale) || 0;
      acc.totalFemale += Number(r.totalFemale) || 0;
      acc.thaiMale += Number(r.thaiMale) || 0;
      acc.thaiFemale += Number(r.thaiFemale) || 0;
      acc.genMale += Number(r.genMale) || 0;
      acc.genFemale += Number(r.genFemale) || 0;
      acc.procMale += Number(r.procMale) || 0;
      acc.procFemale += Number(r.procFemale) || 0;
      acc.refillMale += Number(r.refillMale) || 0;
      acc.refillFemale += Number(r.refillFemale) || 0;
      acc.referDocMale += Number(r.referDocMale) || 0;
      acc.referDocFemale += Number(r.referDocFemale) || 0;
      acc.admitMale += Number(r.admitMale) || 0;
      acc.admitFemale += Number(r.admitFemale) || 0;
      acc.referOutMale += Number(r.referOutMale) || 0;
      acc.referOutFemale += Number(r.referOutFemale) || 0;

      for (const d of normalizeTopItems(r.topDiseases)) {
        const prev = diseaseMap.get(d.name) || { count: 0, male: 0, female: 0 };
        diseaseMap.set(d.name, {
          count: prev.count + d.count,
          male: prev.male + (d.male || 0),
          female: prev.female + (d.female || 0),
        });
      }

      for (const p of normalizeTopItems(r.topProcedures)) {
        const prev = procedureMap.get(p.name) || { count: 0, male: 0, female: 0 };
        procedureMap.set(p.name, {
          count: prev.count + p.count,
          male: prev.male + (p.male || 0),
          female: prev.female + (p.female || 0),
        });
      }
    }

    const totalAll = acc.totalMale + acc.totalFemale;
    const totalThai = acc.thaiMale + acc.thaiFemale;
    const nonThaiMale = Math.max(0, acc.totalMale - acc.thaiMale);
    const nonThaiFemale = Math.max(0, acc.totalFemale - acc.thaiFemale);
    const totalNonThai = nonThaiMale + nonThaiFemale;

    const topDiseases = Array.from(diseaseMap.entries())
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topProcedures = Array.from(procedureMap.entries())
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const daysCount = Math.max(1, filteredReports.length);
    const avgPerDay = Math.round(totalAll / daysCount);

    return {
      ...acc,
      totalAll,
      totalThai,
      nonThaiMale,
      nonThaiFemale,
      totalNonThai,
      avgPerDay,
      topDiseases,
      topProcedures,
    };
  }, [filteredReports]);

  if (reports.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-xl mx-auto my-8">
        <h2 className="text-xl font-bold text-slate-900">ยังไม่มีข้อมูลรายงานในระบบ</h2>
        <p className="text-sm text-slate-600 mt-2">
          เริ่มต้นบันทึกข้อมูลผู้รับบริการประจำวันของหน่วยบริการชั่วคราว รพ.องครักษ์ เพื่อแสดงผลกราฟและสถิติวิเคราะห์
        </p>
        <button
          onClick={onNewReport}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          บันทึกข้อมูลวันแรก
        </button>
      </div>
    );
  }

  const serviceRows = [
    {
      label: 'ตรวจโรคทั่วไป (General OPD)',
      male: stats.genMale,
      female: stats.genFemale,
      total: stats.genMale + stats.genFemale,
    },
    {
      label: 'รับยาต่อเนื่อง / เติมยาเดิม (Medication Refill)',
      male: stats.refillMale,
      female: stats.refillFemale,
      total: stats.refillMale + stats.refillFemale,
    },
    {
      label: 'ทำหัตถการ / ทำแผล / ฉีดยา (Procedures)',
      male: stats.procMale,
      female: stats.procFemale,
      total: stats.procMale + stats.procFemale,
    },
    {
      label: 'ขอใบส่งตัวรักษาต่อ (Referral Document)',
      male: stats.referDocMale,
      female: stats.referDocFemale,
      total: stats.referDocMale + stats.referDocFemale,
    },
    {
      label: 'รับไว้รักษาในโรงพยาบาล (Admit Inpatient)',
      male: stats.admitMale,
      female: stats.admitFemale,
      total: stats.admitMale + stats.admitFemale,
    },
    {
      label: 'ส่งต่อรักษาโรงพยาบาลอื่น (Refer Out)',
      male: stats.referOutMale,
      female: stats.referOutFemale,
      total: stats.referOutMale + stats.referOutFemale,
    },
  ];

  const maxServiceTotal = Math.max(1, ...serviceRows.map((s) => s.total));
  const maxDailyTotal = Math.max(
    1,
    ...sortedReports.map((r) => (Number(r.totalMale) || 0) + (Number(r.totalFemale) || 0))
  );
  const maxDiseaseCount = Math.max(1, ...stats.topDiseases.map((d) => d.count));
  const maxProcedureCount = Math.max(1, ...stats.topProcedures.map((p) => p.count));

  const malePct = stats.totalAll > 0 ? Math.round((stats.totalMale / stats.totalAll) * 100) : 0;
  const femalePct = stats.totalAll > 0 ? 100 - malePct : 0;
  const thaiPct = stats.totalAll > 0 ? Math.round((stats.totalThai / stats.totalAll) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>โรงพยาบาลองครักษ์ จังหวัดนครนายก</span>
            <span aria-hidden="true">·</span>
            <span>หน่วยบริการชั่วคราว</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {rangeMode === 'SINGLE'
                ? `ข้อมูลประจำวันที่ ${formatThaiDate(activeSingleDate)}`
                : `วิเคราะห์ข้อมูลสะสม ${filteredReports.length} วันทำการ`}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tracking-tight">
            รายงานสถิติผู้รับบริการหน่วยบริการชั่วคราว
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 no-print">
          {/* Segmented Range Controls */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setRangeMode('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                rangeMode === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({sortedReports.length} วัน)
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('7D')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                rangeMode === '7D'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 วันล่าสุด
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('MONTH')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                rangeMode === 'MONTH'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              เดือนล่าสุด
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('SINGLE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                rangeMode === 'SINGLE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายวัน
            </button>
          </div>

          {/* Date Selector when SINGLE or quick jump */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              aria-label="เลือกวันที่รายงาน"
              value={rangeMode === 'SINGLE' ? activeSingleDate : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedSingleDate(e.target.value);
                  setRangeMode('SINGLE');
                } else {
                  setRangeMode('ALL');
                }
              }}
              className="border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 tabular-nums"
            >
              <option value="">ดูภาพรวมหลายวัน...</option>
              {[...sortedReports].reverse().map((r) => (
                <option key={r.reportDate} value={r.reportDate}>
                  {r.reportDate} ({formatThaiDate(r.reportDate, true)})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์รายงาน
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (Single-Elevation Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Visits */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">ผู้รับบริการทั้งหมด (Total Visits)</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {stats.totalAll.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                เฉลี่ย {stats.avgPerDay.toLocaleString()} ราย/วัน
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
            <span>ชาย {stats.totalMale.toLocaleString()} ({malePct}%)</span>
            <span aria-hidden="true">·</span>
            <span>หญิง {stats.totalFemale.toLocaleString()} ({femalePct}%)</span>
          </div>
        </div>

        {/* KPI 2: Nationality Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">สัญชาติไทย / ต่างชาติ</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {stats.totalThai.toLocaleString()}
              </span>
              <span className="text-xs text-teal-700 font-medium tabular-nums">
                คนไทย {thaiPct}%
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
            <span>ไทย (ช {stats.thaiMale.toLocaleString()} / ญ {stats.thaiFemale.toLocaleString()})</span>
            <span aria-hidden="true">·</span>
            <span>ต่างชาติ {stats.totalNonThai.toLocaleString()} ราย</span>
          </div>
        </div>

        {/* KPI 3: General OPD & Medication Refill */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">ตรวจโรคทั่วไป & รับยาต่อเนื่อง</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {(stats.genMale + stats.genFemale + stats.refillMale + stats.refillFemale).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                ตรวจโรค {(stats.genMale + stats.genFemale).toLocaleString()} ราย
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
            <span>OPD (ช {stats.genMale} / ญ {stats.genFemale})</span>
            <span aria-hidden="true">·</span>
            <span>รับยาเดิม {(stats.refillMale + stats.refillFemale).toLocaleString()} ราย</span>
          </div>
        </div>

        {/* KPI 4: Procedures, Referrals & Admissions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">หัตถการ · ใบส่งตัว · Admit · Refer</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {(stats.procMale + stats.procFemale).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                ทำหัตถการรวม (ครั้ง)
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
            <span>ใบส่งตัว {stats.referDocMale + stats.referDocFemale}</span>
            <span aria-hidden="true">·</span>
            <span>Admit {stats.admitMale + stats.admitFemale}</span>
            <span aria-hidden="true">·</span>
            <span>Refer Out {stats.referOutMale + stats.referOutFemale}</span>
          </div>
        </div>
      </div>

      {/* Main Analytics Row: Daily Trend Chart + Service Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Volume Trend (7 Columns) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  แนวโน้มผู้รับบริการรายวัน (แยกตามเพศ)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  คลิกที่แท่งกราฟเพื่อดูรายละเอียดเฉพาะของแต่ละวัน หรือกลับมาดูภาพรวมทั้งหมด
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" />
                  ชาย (Male)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 inline-block" />
                  หญิง (Female)
                </span>
              </div>
            </div>

            {/* Interactive Bar Chart */}
            <div className="mt-6 pt-4">
              <div className="h-56 flex items-end gap-2 sm:gap-3 border-b border-slate-200 pb-2 px-1">
                {sortedReports.map((r) => {
                  const m = Number(r.totalMale) || 0;
                  const f = Number(r.totalFemale) || 0;
                  const tot = m + f;
                  const heightPct = Math.max(8, Math.round((tot / maxDailyTotal) * 100));
                  const maleRatio = tot > 0 ? Math.round((m / tot) * 100) : 50;
                  const femaleRatio = 100 - maleRatio;
                  const isSelected =
                    rangeMode === 'SINGLE' && activeSingleDate === r.reportDate;

                  return (
                    <button
                      key={r.reportDate}
                      type="button"
                      onClick={() => {
                        if (rangeMode === 'SINGLE' && activeSingleDate === r.reportDate) {
                          setRangeMode('ALL');
                        } else {
                          setSelectedSingleDate(r.reportDate);
                          setRangeMode('SINGLE');
                        }
                      }}
                      title={`${formatThaiDate(r.reportDate)}: รวม ${tot} ราย (ชาย ${m}, หญิง ${f})`}
                      className={`group flex-1 flex flex-col items-center justify-end h-full focus:outline-none transition-opacity ${
                        rangeMode === 'SINGLE' && !isSelected ? 'opacity-45 hover:opacity-80' : 'opacity-100'
                      }`}
                    >
                      <span className="text-[11px] font-mono tabular-nums text-slate-700 font-semibold mb-1.5">
                        {tot}
                      </span>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[42px] rounded-t-md overflow-hidden flex flex-col justify-end transition-transform group-hover:-translate-y-0.5 ${
                          isSelected ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                        }`}
                      >
                        <div
                          style={{ height: `${femaleRatio}%` }}
                          className="w-full bg-teal-500 transition-colors"
                        />
                        <div
                          style={{ height: `${maleRatio}%` }}
                          className="w-full bg-sky-600 transition-colors"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* X-Axis Labels */}
              <div className="flex items-center gap-2 sm:gap-3 pt-2 px-1">
                {sortedReports.map((r) => {
                  const parts = r.reportDate.split('-');
                  const shortLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : r.reportDate;
                  const isSelected =
                    rangeMode === 'SINGLE' && activeSingleDate === r.reportDate;
                  return (
                    <div
                      key={r.reportDate}
                      className={`flex-1 text-center text-[11px] tabular-nums truncate ${
                        isSelected ? 'font-bold text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {shortLabel}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom summary bar */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              วันที่มีผู้รับบริการสูงสุด:{' '}
              <strong className="text-slate-800 tabular-nums">
                {(() => {
                  const peak = [...sortedReports].sort(
                    (a, b) =>
                      b.totalMale + b.totalFemale - (a.totalMale + a.totalFemale)
                  )[0];
                  return peak
                    ? `${formatThaiDate(peak.reportDate, true)} (${peak.totalMale + peak.totalFemale} ราย)`
                    : '-';
                })()}
              </strong>
            </span>
            {rangeMode === 'SINGLE' && (
              <button
                type="button"
                onClick={() => onEditDate(activeSingleDate)}
                className="inline-flex items-center gap-1 text-teal-700 font-medium hover:underline no-print"
              >
                แก้ไขข้อมูลวันที่ {activeSingleDate}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Service Channel Breakdown (5 Columns) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                จำแนกตามประเภทการรับบริการ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เปรียบเทียบจำนวนผู้รับบริการแยกตามแผนกและเพศ (ชาย / หญิง)
              </p>
            </div>

            <div className="mt-4 space-y-4">
              {serviceRows.map((row) => {
                const widthPct = Math.max(2, Math.round((row.total / maxServiceTotal) * 100));
                const mPct = row.total > 0 ? Math.round((row.male / row.total) * 100) : 0;
                const fPct = row.total > 0 ? 100 - mPct : 0;

                return (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-slate-800">{row.label}</span>
                      <span className="tabular-nums text-slate-600">
                        <strong className="text-slate-900 font-semibold text-sm">
                          {row.total.toLocaleString()}
                        </strong>{' '}
                        (ช {row.male.toLocaleString()} · ญ {row.female.toLocaleString()})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className="h-full flex rounded-full overflow-hidden"
                      >
                        <div
                          style={{ width: `${mPct}%` }}
                          className="bg-sky-600 h-full"
                          title={`ชาย ${row.male} ราย`}
                        />
                        <div
                          style={{ width: `${fPct}%` }}
                          className="bg-teal-500 h-full"
                          title={`หญิง ${row.female} ราย`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 tabular-nums">
            <span>สัดส่วนเพศรวม: ชาย {malePct}% · หญิง {femalePct}%</span>
            <span>สัญชาติไทย {thaiPct}%</span>
          </div>
        </div>
      </div>

      {/* Top 5 Diseases & Top 5 Procedures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Diseases */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-baseline justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                01. 5 อันดับโรคที่พบบ่อย (Top 5 Diseases)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                รหัสโรค ICD-10 และกลุ่มอาการที่ผู้ป่วยมารับบริการสูงสุดในช่วงเวลาที่เลือก
              </p>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">จำนวน (ราย)</span>
          </div>

          {stats.topDiseases.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              ไม่มีข้อมูลการจัดอันดับโรคในช่วงเวลานี้
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {stats.topDiseases.map((item, idx) => {
                const barW = Math.max(4, Math.round((item.count / maxDiseaseCount) * 100));
                return (
                  <div key={item.name} className="py-3 first:pt-1 last:pb-1 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <div className="flex items-baseline gap-2.5 min-w-0">
                        <span className="text-xs font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                          0{idx + 1}.
                        </span>
                        <span className="font-medium text-slate-900 truncate" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <span className="font-bold text-slate-900">{item.count.toLocaleString()}</span>
                        {(item.male > 0 || item.female > 0) && (
                          <span className="text-xs text-slate-500 ml-1.5">
                            (ช {item.male} · ญ {item.female})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${barW}%` }}
                        className="h-full bg-teal-600 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 5 Procedures */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-baseline justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                02. 5 อันดับหัตถการ (Top 5 Procedures)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                รายการหัตถการทางการพยาบาลและการตรวจพิเศษที่ให้บริการสูงสุด
              </p>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">จำนวน (ครั้ง)</span>
          </div>

          {stats.topProcedures.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              ไม่มีข้อมูลการจัดอันดับหัตถการในช่วงเวลานี้
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {stats.topProcedures.map((item, idx) => {
                const barW = Math.max(4, Math.round((item.count / maxProcedureCount) * 100));
                return (
                  <div key={item.name} className="py-3 first:pt-1 last:pb-1 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <div className="flex items-baseline gap-2.5 min-w-0">
                        <span className="text-xs font-mono font-semibold text-sky-700 tabular-nums shrink-0">
                          0{idx + 1}.
                        </span>
                        <span className="font-medium text-slate-900 truncate" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <span className="font-bold text-slate-900">{item.count.toLocaleString()}</span>
                        {(item.male > 0 || item.female > 0) && (
                          <span className="text-xs text-slate-500 ml-1.5">
                            (ช {item.male} · ญ {item.female})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${barW}%` }}
                        className="h-full bg-sky-600 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Daily Shift Notes Log */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              03. บันทึกหมายเหตุประจำวัน (Reporter Notes)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              สรุปเหตุการณ์สำคัญและการส่งต่อผู้ป่วยจากเจ้าหน้าที่เวรประจำวัน
            </p>
          </div>
        </div>

        <div className="mt-2 divide-y divide-slate-100">
          {[...filteredReports]
            .reverse()
            .slice(0, 5)
            .map((r) => (
              <div
                key={r.reportDate}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                    <span className="font-semibold text-slate-800">{r.reportDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatThaiDate(r.reportDate, true)}</span>
                    <span aria-hidden="true">·</span>
                    <span>ผู้รับบริการรวม {(r.totalMale + r.totalFemale).toLocaleString()} ราย</span>
                  </div>
                  <p className="text-slate-700">
                    {r.reporterNote ? r.reporterNote : 'ไม่มีหมายเหตุเพิ่มเติม'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEditDate(r.reportDate)}
                  className="text-xs text-teal-700 font-medium hover:underline shrink-0 self-start sm:self-center no-print"
                >
                  แก้ไขข้อมูล
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
