'use client';

import { CalendarDays, ChevronLeft, ChevronRight, FilePlus2, Pencil, Printer } from 'lucide-react';
import { DailyReport, formatThaiDate, normalizeTopItems } from '../types/report';

export interface DashboardViewProps {
  reports: DailyReport[];
  periodEndDate: string;
  onPeriodChange: (date: string) => void;
  onEditDate: (date: string) => void;
  onNewReport: (date?: string) => void;
}

function shiftDate(value: string, delta: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function metric(reports: DailyReport[], key: keyof DailyReport): number {
  return reports.reduce((total, report) => total + (Number(report[key]) || 0), 0);
}

export function DashboardView({ reports, periodEndDate, onPeriodChange, onEditDate, onNewReport }: DashboardViewProps) {
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(periodEndDate, index - 6));
  const byDate = new Map(reports.map((report) => [report.reportDate, report]));
  const periodReports = dates.flatMap((date) => { const report = byDate.get(date); return report ? [report] : []; });
  const totalMale = metric(periodReports, 'totalMale');
  const totalFemale = metric(periodReports, 'totalFemale');
  const total = totalMale + totalFemale;
  const missing = dates.filter((date) => !byDate.has(date));
  const diseases = new Map<string, number>();
  const procedures = new Map<string, number>();
  periodReports.forEach((report) => {
    normalizeTopItems(report.topDiseases).forEach((item) => diseases.set(item.name, (diseases.get(item.name) ?? 0) + item.count));
    normalizeTopItems(report.topProcedures).forEach((item) => procedures.set(item.name, (procedures.get(item.name) ?? 0) + item.count));
  });
  const top = (values: Map<string, number>) => [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">หน่วยบริการชั่วคราว โรงพยาบาลองครักษ์</p><h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">ภาพรวมสถิติผู้รับบริการ</h1></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onPeriodChange(shiftDate(periodEndDate, -7))} className="control-button" aria-label="ช่วงก่อนหน้า"><ChevronLeft className="h-4 w-4" />ก่อนหน้า</button><label htmlFor="period-end" className="sr-only">วันสิ้นสุดช่วงรายงาน</label><input id="period-end" type="date" value={periodEndDate} onChange={(event) => onPeriodChange(event.target.value)} className="control-input font-mono tabular-nums" /><button type="button" onClick={() => onPeriodChange(shiftDate(periodEndDate, 7))} className="control-button" aria-label="ช่วงถัดไป">ถัดไป<ChevronRight className="h-4 w-4" /></button><button type="button" onClick={() => window.print()} className="control-button"><Printer className="h-4 w-4" />พิมพ์</button><button type="button" onClick={() => onNewReport(periodEndDate)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"><FilePlus2 className="h-4 w-4" />บันทึกวันนี้</button></div></div>
    <div className="flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4 text-teal-700" /><span>แสดง 7 วันปฏิทิน: {formatThaiDate(dates[0], true)} – {formatThaiDate(dates[6], true)}</span></div>
    {missing.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ยังไม่มีรายงานสำหรับ {missing.length} วัน: {missing.map((date) => <button type="button" key={date} onClick={() => onNewReport(date)} className="ml-1 font-semibold underline underline-offset-2">{formatThaiDate(date, true)}</button>)}</div>}
    <div className="grid gap-4 sm:grid-cols-3"><article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">ผู้รับบริการรวมในช่วงนี้</p><p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">{total.toLocaleString('th-TH')}</p><p className="mt-1 text-xs text-slate-500">ชาย {totalMale.toLocaleString('th-TH')} · หญิง {totalFemale.toLocaleString('th-TH')}</p></article><article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">วันที่บันทึกแล้ว</p><p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">{periodReports.length}<span className="text-lg font-normal text-slate-500"> / 7</span></p><p className="mt-1 text-xs text-slate-500">เฉลี่ย {periodReports.length ? Math.round(total / periodReports.length).toLocaleString('th-TH') : 0} รายต่อวันที่บันทึก</p></article><article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">แพทย์แผนไทยในช่วงนี้</p><p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">{(metric(periodReports, 'thaiMale') + metric(periodReports, 'thaiFemale')).toLocaleString('th-TH')}</p><p className="mt-1 text-xs text-slate-500">ยอดหมวดบริการอาจนับซ้ำกับยอดรวม</p></article></div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-4 py-4 sm:px-6"><h2 className="font-display text-base font-bold text-slate-900">รายงานรายวัน</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-4 py-3 font-semibold sm:px-6">วันที่</th><th className="px-4 py-3 text-right font-semibold">รวม ชาย</th><th className="px-4 py-3 text-right font-semibold">รวม หญิง</th><th className="px-4 py-3 text-right font-semibold">รวมทั้งหมด</th><th className="px-4 py-3 font-semibold">สถานะ</th><th className="px-4 py-3 text-right font-semibold">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{dates.map((date) => { const report = byDate.get(date); const dayTotal = report ? report.totalMale + report.totalFemale : 0; return <tr key={date} className="hover:bg-slate-50"><td className="px-4 py-3 sm:px-6"><span className="font-medium text-slate-900">{formatThaiDate(date, true)}</span><span className="ml-2 font-mono text-xs text-slate-500">{date}</span></td><td className="px-4 py-3 text-right font-mono tabular-nums">{report?.totalMale ?? '—'}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{report?.totalFemale ?? '—'}</td><td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{report ? dayTotal : '—'}</td><td className="px-4 py-3">{report ? <span className="text-teal-700">บันทึกแล้ว</span> : <span className="text-amber-700">ยังไม่มีข้อมูล</span>}</td><td className="px-4 py-3 text-right">{report ? <button type="button" onClick={() => onEditDate(date)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"><Pencil className="h-3.5 w-3.5" />แก้ไข</button> : <button type="button" onClick={() => onNewReport(date)} className="rounded-lg px-2 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50">เพิ่มรายงาน</button>}</td></tr>; })}</tbody></table></div></section>
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-display text-base font-bold text-slate-900">โรคที่พบบ่อย</h2><ol className="mt-4 space-y-3">{top(diseases).map(([name, count], index) => <li key={name} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 text-sm"><span><span className="mr-2 font-mono text-xs text-slate-500">{index + 1}</span>{name}</span><span className="font-mono font-semibold tabular-nums text-slate-700">{count}</span></li>)}{diseases.size === 0 && <li className="text-sm text-slate-500">ยังไม่มีข้อมูลโรคในช่วงนี้</li>}</ol></section><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-display text-base font-bold text-slate-900">หัตถการที่พบบ่อย</h2><ol className="mt-4 space-y-3">{top(procedures).map(([name, count], index) => <li key={name} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 text-sm"><span><span className="mr-2 font-mono text-xs text-slate-500">{index + 1}</span>{name}</span><span className="font-mono font-semibold tabular-nums text-slate-700">{count}</span></li>)}{procedures.size === 0 && <li className="text-sm text-slate-500">ยังไม่มีข้อมูลหัตถการในช่วงนี้</li>}</ol></section></div>
  </div>;
}
