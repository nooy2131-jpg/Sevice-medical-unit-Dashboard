import React, { useState } from 'react';
import { FIXED_CODE_GS, STANDALONE_INDEX_HTML } from '../data/gasTemplates';
import { Check, Copy, AlertTriangle } from 'lucide-react';

export const GasSetupView: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'code_gs' | 'index_html'>('code_gs');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopy = async (content: string, key: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(key);
      setTimeout(() => setCopiedFile(null), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Google Apps Script (GAS)</span>
          <span aria-hidden="true">·</span>
          <span>โครงสร้างไฟล์ Code.gs และ Index.html สำหรับเชื่อมต่อ Google Sheet</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          ตรวจสอบและคัดลอกโค้ดสำหรับติดตั้งใน Google Sheets
        </h1>
      </div>

      {/* Diagnostic Alert Explaining the Bug in User's Pasted Code.gs */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-sm">
            <h2 className="font-bold text-amber-950">
              ตรวจพบจุดผิดพลาด (Syntax Error) ในโค้ด Code.gs ต้นฉบับที่คุณส่งมา และแก้ไขให้เรียบร้อยแล้ว
            </h2>
            <p className="text-amber-900 leading-relaxed">
              ในโค้ด <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">Code.gs</code> ที่คุณวางมา บรรทัดถัดจากฟังก์ชัน{' '}
              <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">normalizeDateString(d, timeZone)</code>{' '}
              มีโค้ดส่วนท้ายของฟังก์ชัน <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">getReportsData()</code>{' '}
              และฟังก์ชัน <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">deleteReportData(dateStr)</code>{' '}
              ถูกวางซ้ำซ้อนอยู่นอกปีกกาฟังก์ชัน ทำให้เกิดข้อผิดพลาด{' '}
              <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">SyntaxError: Unexpected token &apos;&#125;&apos;</code>{' '}
              เวลาบันทึกใน Google Apps Script
            </p>
            <div className="text-xs text-amber-800 pt-1">
              1. ลบโค้ดส่วนที่ซ้ำซ้อนนอกฟังก์ชันออกทั้งหมด · 2. ปรับปรุงการแปลงชนิดตัวเลขและวันที่ <code className="font-mono">UpdatedAt</code> ให้ปลอดภัย 100% · 3. เตรียมไฟล์ <code className="font-mono">Index.html</code> ฉบับสมบูรณ์ไว้ให้พร้อมใช้งานคู่กัน
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Guide */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
          ขั้นตอนการนำไปติดตั้งใน Google Sheets (ใช้เวลาไม่เกิน 2 นาที)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">01. วางโค้ดใน Code.gs</div>
            <p>
              เปิดไฟล์ Google Sheet ของโรงพยาบาล ไปที่เมนู <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong> ลบโค้ดเดิมในไฟล์ <code className="font-mono">Code.gs</code> ออกทั้งหมด แล้ววางโค้ดฉบับแก้ไขด้านล่างลงไปแทน
            </p>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">02. สร้างไฟล์ Index.html</div>
            <p>
              ในหน้า Apps Script กดปุ่มเครื่องหมาย <strong>+ (เพิ่มไฟล์) &gt; HTML</strong> ตั้งชื่อไฟล์ว่า <code className="font-mono">Index</code> (ตัว I พิมพ์ใหญ่ ไม่ต้องใส่ .html ซ้ำ) แล้วคัดลอกโค้ดจากแท็บ <code className="font-mono">Index.html</code> ด้านล่างไปวาง
            </p>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-sm">03. การทำให้ใช้งานได้ (Deploy)</div>
            <p>
              กดปุ่ม <strong>การทำให้ใช้งานได้ (Deploy) &gt; การทำให้ใช้งานได้รายการใหม่ (New deployment)</strong> เลือกประเภทเป็น <strong>เว็บแอป (Web app)</strong> ตั้งค่าผู้มีสิทธิ์เข้าถึงตามต้องการ แล้วกด Deploy
            </p>
          </div>
        </div>
      </div>

      {/* Code Viewer & Copy Box */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveFile('code_gs')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeFile === 'code_gs'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. ไฟล์ Code.gs (ฉบับแก้ไขบั๊กแล้ว)
            </button>
            <button
              type="button"
              onClick={() => setActiveFile('index_html')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeFile === 'index_html'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. ไฟล์ Index.html (สำหรับแสดงหน้าเว็บ GAS)
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              handleCopy(
                activeFile === 'code_gs' ? FIXED_CODE_GS : STANDALONE_INDEX_HTML,
                activeFile
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
          >
            {copiedFile === activeFile ? (
              <>
                <Check className="w-3.5 h-3.5" />
                คัดลอกโค้ดเรียบร้อยแล้ว
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                คัดลอกโค้ด {activeFile === 'code_gs' ? 'Code.gs' : 'Index.html'}
              </>
            )}
          </button>
        </div>

        <pre className="p-5 text-xs font-mono text-slate-800 bg-white overflow-x-auto max-h-[540px] leading-relaxed">
          <code>{activeFile === 'code_gs' ? FIXED_CODE_GS : STANDALONE_INDEX_HTML}</code>
        </pre>
      </div>
    </div>
  );
};
