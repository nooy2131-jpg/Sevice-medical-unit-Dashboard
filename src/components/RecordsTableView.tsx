import React, { useMemo, useState } from 'react';
import { DailyReport, formatThaiDate, normalizeTopItems } from '../types/report';
import { Download, Upload, Search, Trash2, Edit3, Eye, X, Plus } from 'lucide-react';

interface RecordsTableViewProps {
  reports: DailyReport[];
  onEditDate: (dateStr: string) => void;
  onNewReport: () => void;
  onDeleteDate: (dateStr: string) => void;
  onExportCsv: () => void;
  onImportReports: (imported: DailyReport[]) => void;
}

export const RecordsTableView: React.FC<RecordsTableViewProps> = ({
  reports,
  onEditDate,
  onNewReport,
  onDeleteDate,
  onExportCsv,
  onImportReports,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'total-desc'>('date-desc');
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [inspectReport, setInspectReport] = useState<DailyReport | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importError, setImportError] = useState<string>('');

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reports.filter((r) => {
      if (!q) return true;
      const inDate =
        r.reportDate.toLowerCase().includes(q) || formatThaiDate(r.reportDate).includes(q);
      const inNote = (r.reporterNote || '').toLowerCase().includes(q);
      const inDiseases = normalizeTopItems(r.topDiseases).some((d) =>
        d.name.toLowerCase().includes(q)
      );
      const inProcedures = normalizeTopItems(r.topProcedures).some((p) =>
        p.name.toLowerCase().includes(q)
      );
      return inDate || inNote || inDiseases || inProcedures;
    });

    return list.sort((a, b) => {
      if (sortBy === 'date-asc') return a.reportDate.localeCompare(b.reportDate);
      if (sortBy === 'total-desc') {
        return b.totalMale + b.totalFemale - (a.totalMale + a.totalFemale);
      }
      return b.reportDate.localeCompare(a.reportDate);
    });
  }, [reports, searchQuery, sortBy]);

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    const raw = importText.trim();
    if (!raw) {
      setImportError('กรุณาวางข้อมูลที่ต้องการนำเข้า');
      return;
    }

    try {
      if (raw.startsWith('{') || raw.startsWith('[')) {
        const parsed = JSON.parse(raw);
        const list: DailyReport[] = Array.isArray(parsed)
          ? parsed
          : Object.values(parsed);
        const valid = list.filter((item) => item && typeof item.reportDate === 'string');
        if (valid.length === 0) {
          setImportError('ไม่พบข้อมูลวันที่รายงานที่ถูกต้อง');
          return;
        }
        onImportReports(valid);
        setShowImportModal(false);
        setImportText('');
        return;
      }

      const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setImportError('ข้อมูล CSV ต้องมีอย่างน้อยหัวตารางและข้อมูล 1 แถว');
        return;
      }
      const parsedRows: DailyReport[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols =
          lines[i].split('\t').length >= 17 ? lines[i].split('\t') : lines[i].split(',');
        const dateStr = (cols[0] || '').replace(/^"|"$/g, '').trim().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
        parsedRows.push({
          reportDate: dateStr,
          totalMale: Number(cols[1]) || 0,
          totalFemale: Number(cols[2]) || 0,
          thaiMale: Number(cols[3]) || 0,
          thaiFemale: Number(cols[4]) || 0,
          genMale: Number(cols[5]) || 0,
          genFemale: Number(cols[6]) || 0,
          procMale: Number(cols[7]) || 0,
          procFemale: Number(cols[8]) || 0,
          refillMale: Number(cols[9]) || 0,
          refillFemale: Number(cols[10]) || 0,
          referDocMale: Number(cols[11]) || 0,
          referDocFemale: Number(cols[12]) || 0,
          admitMale: Number(cols[13]) || 0,
          admitFemale: Number(cols[14]) || 0,
          referOutMale: Number(cols[15]) || 0,
          referOutFemale: Number(cols[16]) || 0,
          topDiseases: [],
          topProcedures: [],
          reporterNote: cols[19] ? String(cols[19]).replace(/^"|"$/g, '') : '',
          updatedAt: cols[20] ? String(cols[20]).replace(/^"|"$/g, '') : new Date().toISOString(),
        });
      }

      if (parsedRows.length === 0) {
        setImportError('ไม่สามารถแปลงข้อมูลได้ กรุณาตรวจสอบว่าคอลัมน์แรกเป็นวันที่ YYYY-MM-DD');
        return;
      }

      onImportReports(parsedRows);
      setShowImportModal(false);
      setImportText('');
    } catch (err) {
      setImportError('รูปแบบข้อมูลไม่ถูกต้อง: ' + String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>หน่วยบริการชั่วคราว โรงพยาบาลองครักษ์</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">บันทึกทั้งหมด {reports.length} วันทำการ</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            ตารางข้อมูลรายงานประจำวันย้อนหลัง
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาวันที่ ชื่อโรค หัตถการ หมายเหตุ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 w-60"
            />
          </div>

          <select
            aria-label="เรียงลำดับข้อมูล"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="date-desc">วันที่ล่าสุดก่อน</option>
            <option value="date-asc">วันที่เก่าสุดก่อน</option>
            <option value="total-desc">ยอดผู้รับบริการมากสุดก่อน</option>
          </select>

          <button
            type="button"
            onClick={onNewReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่ม/แก้ไขข้อมูลย้อนหลัง
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            นำเข้าข้อมูล
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            disabled={reports.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            ส่งออก CSV
          </button>
        </div>
      </div>

      {/* High-Density Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4 whitespace-nowrap">วันที่รายงาน</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ผู้รับบริการรวม (ช/ญ)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">แพทย์แผนไทย (ช/ญ)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ตรวจโรคทั่วไป</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">หัตถการ</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">รับยาเดิม</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ใบส่งตัว</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Admit / Refer</th>
                <th className="py-3 px-4 whitespace-nowrap">โรคอันดับ 1 · หมายเหตุ</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">จัดการข้อมูลย้อนหลัง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    ยังไม่มีรายการข้อมูลในตาราง กดปุ่ม &ldquo;เพิ่ม/แก้ไขข้อมูลย้อนหลัง&rdquo; เพื่อเริ่มบันทึกข้อมูล
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((r) => {
                  const totAll = (Number(r.totalMale) || 0) + (Number(r.totalFemale) || 0);
                  const totThaiMed = (Number(r.thaiMale) || 0) + (Number(r.thaiFemale) || 0);
                  const totGen = (Number(r.genMale) || 0) + (Number(r.genFemale) || 0);
                  const totProc = (Number(r.procMale) || 0) + (Number(r.procFemale) || 0);
                  const totRefill = (Number(r.refillMale) || 0) + (Number(r.refillFemale) || 0);
                  const totReferDoc =
                    (Number(r.referDocMale) || 0) + (Number(r.referDocFemale) || 0);
                  const totAdmit = (Number(r.admitMale) || 0) + (Number(r.admitFemale) || 0);
                  const totReferOut =
                    (Number(r.referOutMale) || 0) + (Number(r.referOutFemale) || 0);
                  const topDis = normalizeTopItems(r.topDiseases)[0];

                  return (
                    <tr key={r.reportDate} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {r.reportDate}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatThaiDate(r.reportDate, true)}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {totAll.toLocaleString()}
                        </span>
                        <span className="text-slate-500 ml-1">
                          ({r.totalMale || 0}/{r.totalFemale || 0})
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                        <span className="font-semibold text-teal-800">
                          {totThaiMed.toLocaleString()}
                        </span>
                        <span className="text-slate-400 ml-1">
                          ({r.thaiMale || 0}/{r.thaiFemale || 0})
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                        <span className="font-semibold">{totGen}</span>
                        <span className="text-slate-400 ml-1">
                          ({r.genMale || 0}/{r.genFemale || 0})
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                        <span className="font-semibold">{totProc}</span>
                        <span className="text-slate-400 ml-1">
                          ({r.procMale || 0}/{r.procFemale || 0})
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                        <span className="font-semibold">{totRefill}</span>
                        <span className="text-slate-400 ml-1">
                          ({r.refillMale || 0}/{r.refillFemale || 0})
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                        <span className="font-semibold">{totReferDoc}</span>
                        <span className="text-slate-400 ml-1">
                          ({r.referDocMale || 0}/{r.referDocFemale || 0})
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-slate-700">
                        <span>Admit {totAdmit}</span>
                        <span className="mx-1 text-slate-300">·</span>
                        <span>Refer {totReferOut}</span>
                      </td>

                      <td className="py-2.5 px-4 max-w-xs">
                        {topDis && (
                          <div className="text-slate-800 font-medium truncate" title={topDis.name}>
                            {topDis.name} ({topDis.count})
                          </div>
                        )}
                        <div className="text-slate-500 truncate" title={r.reporterNote}>
                          {r.reporterNote || '-'}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {deletingDate === r.reportDate ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteDate(r.reportDate);
                                setDeletingDate(null);
                              }}
                              className="px-2 py-1 bg-red-600 text-white rounded text-[11px] font-medium hover:bg-red-700"
                            >
                              ยืนยันลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDate(null)}
                              className="px-2 py-1 text-slate-600 hover:text-slate-900 text-[11px]"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectReport(r)}
                              title="ดูรายละเอียด"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditDate(r.reportDate)}
                              title="แก้ไขข้อมูลย้อนหลังของวันนี้"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-md font-medium transition-colors"
                            >
                              <Edit3 className="w-3 h-3" />
                              แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDate(r.reportDate)}
                              title="ลบแถวนี้"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Inspect Single Day Report Details */}
      {inspectReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs text-slate-500 tabular-nums">
                  วันที่ {inspectReport.reportDate} · อัปเดตล่าสุด {inspectReport.updatedAt || '-'}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  รายงานประจำวันที่ {formatThaiDate(inspectReport.reportDate)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectReport(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                {
                  label: 'ผู้รับบริการทั้งหมด',
                  m: inspectReport.totalMale || 0,
                  f: inspectReport.totalFemale || 0,
                },
                {
                  label: 'แพทย์แผนไทย',
                  m: inspectReport.thaiMale || 0,
                  f: inspectReport.thaiFemale || 0,
                },
                {
                  label: 'ตรวจโรคทั่วไป',
                  m: inspectReport.genMale || 0,
                  f: inspectReport.genFemale || 0,
                },
                {
                  label: 'ทำหัตถการ',
                  m: inspectReport.procMale || 0,
                  f: inspectReport.procFemale || 0,
                },
                {
                  label: 'รับยาต่อเนื่อง',
                  m: inspectReport.refillMale || 0,
                  f: inspectReport.refillFemale || 0,
                },
                {
                  label: 'ขอใบส่งตัว',
                  m: inspectReport.referDocMale || 0,
                  f: inspectReport.referDocFemale || 0,
                },
                {
                  label: 'รับไว้รักษา (Admit)',
                  m: inspectReport.admitMale || 0,
                  f: inspectReport.admitFemale || 0,
                },
                {
                  label: 'ส่งต่อ (Refer Out)',
                  m: inspectReport.referOutMale || 0,
                  f: inspectReport.referOutFemale || 0,
                },
              ].map((item) => (
                <div key={item.label} className="border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">{item.label}</div>
                  <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                    {item.m + item.f}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    ชาย {item.m} · หญิง {item.f}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 mb-2">5 อันดับโรคที่พบบ่อย</h4>
                <div className="space-y-1.5">
                  {normalizeTopItems(inspectReport.topDiseases).map((d, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-700">
                        {i + 1}. {d.name}
                      </span>
                      <span className="font-mono font-semibold tabular-nums">{d.count} ราย</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-2">5 อันดับหัตถการ</h4>
                <div className="space-y-1.5">
                  {normalizeTopItems(inspectReport.topProcedures).map((p, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-700">
                        {i + 1}. {p.name}
                      </span>
                      <span className="font-mono font-semibold tabular-nums">{p.count} ครั้ง</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-xs">
              <span className="font-semibold text-slate-900">หมายเหตุเพิ่มเติม: </span>
              <span className="text-slate-600">{inspectReport.reporterNote || '-'}</span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const d = inspectReport.reportDate;
                  setInspectReport(null);
                  onEditDate(d);
                }}
                className="px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700"
              >
                แก้ไขข้อมูลย้อนหลังของวันนี้
              </button>
              <button
                type="button"
                onClick={() => setInspectReport(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import JSON / CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleImportSubmit}
            className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">นำเข้าข้อมูล (CSV หรือ JSON)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  วางข้อมูลจากตารางหรือไฟล์ที่ส่งออกไว้เพื่อนำเข้าสู่ระบบ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {importError}
              </div>
            )}

            <textarea
              rows={7}
              placeholder="วางข้อมูล CSV หรือ JSON ที่ต้องการนำเข้า..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700"
              >
                นำเข้าข้อมูล
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
