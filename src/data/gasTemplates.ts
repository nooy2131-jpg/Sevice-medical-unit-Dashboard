export const FIXED_CODE_GS = `/**
 * ==============================================================================
 * โค้ดฝั่ง Server (Google Apps Script - Code.gs) [ฉบับแก้ไขบั๊กโค้ดซ้ำซ้อนแล้ว]
 * ระบบ Dashboard ผู้ใช้บริการ หน่วยบริการชั่วคราว รพ.องครักษ์ จ.นครนายก
 * ==============================================================================
 */

/**
 * 1. ฟังก์ชันเปิดหน้าเว็บ Web App (เมื่อผู้ใช้เปิด ลิงก์ Web App จะเรียกฟังก์ชันนี้)
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Dashboard ผู้ใช้บริการ หน่วยบริการชั่วคราว รพ.องครักษ์')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 2. ฟังก์ชันบันทึกหรืออัปเดตข้อมูลรายงานประจำวันลงใน Google Sheet
 * @param {string} reportJson ข้อมูลรายงานที่ส่งมาจากหน้าเว็บในรูปแบบข้อความ JSON
 */
function saveReportData(reportJson) {
  try {
    var sheet = getOrCreateSheet();
    var data = JSON.parse(reportJson);
    var reportDate = data.reportDate; // วันที่รายงาน (รูปแบบ YYYY-MM-DD)
    
    var rows = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var timeZone = Session.getScriptTimeZone() || "Asia/Bangkok";
    
    // ค้นหาแถวที่มีวันที่ตรงกัน (ถ้ามี จะทำการเขียนทับแถวเดิม)
    for (var i = 1; i < rows.length; i++) {
      var d = rows[i][0];
      var formattedD = normalizeDateString(d, timeZone);
      if (formattedD === reportDate) {
        rowIndex = i + 1; // ตำแหน่งแถวใน Sheet (เริ่มนับที่ 1)
        break;
      }
    }
    
    // จัดเตรียมข้อมูลที่จะบันทึกลงแต่ละคอลัมน์ (รวม 21 คอลัมน์)
    var rowData = [
      data.reportDate,
      Number(data.totalMale) || 0,
      Number(data.totalFemale) || 0,
      Number(data.thaiMale) || 0,
      Number(data.thaiFemale) || 0,
      Number(data.genMale) || 0,
      Number(data.genFemale) || 0,
      Number(data.procMale) || 0,
      Number(data.procFemale) || 0,
      Number(data.refillMale) || 0,
      Number(data.refillFemale) || 0,
      Number(data.referDocMale) || 0,
      Number(data.referDocFemale) || 0,
      Number(data.admitMale) || 0,
      Number(data.admitFemale) || 0,
      Number(data.referOutMale) || 0,
      Number(data.referOutFemale) || 0,
      JSON.stringify(data.topDiseases || []),   // รายการ TOP 5 โรค เป็น JSON
      JSON.stringify(data.topProcedures || []), // รายการ TOP 5 หัตถการ เป็น JSON
      data.reporterNote || '',                  // หมายเหตุเพิ่มเติม
      Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss') // เวลาที่บันทึก
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return { status: 'success', date: reportDate };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * 3. ฟังก์ชันดึงข้อมูลรายงานทั้งหมดใน Sheet ส่งกลับไปยัง Dashboard หน้าเว็บ
 */
function getReportsData() {
  try {
    var sheet = getOrCreateSheet();
    var rows = sheet.getDataRange().getValues();
    var reportsMap = {};
    var timeZone = Session.getScriptTimeZone() || "Asia/Bangkok";
    
    if (rows.length <= 1) return JSON.stringify(reportsMap);
    
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var rawDate = r[0];
      if (!rawDate) continue;
      
      var dateStr = normalizeDateString(rawDate, timeZone);
      if (!dateStr) continue;
      
      var topDiseases = [];
      var topProcedures = [];
      try { topDiseases = JSON.parse(r[17] || '[]'); } catch(e) {}
      try { topProcedures = JSON.parse(r[18] || '[]'); } catch(e) {}
      
      var updatedVal = r[20];
      if (updatedVal instanceof Date) {
        updatedVal = Utilities.formatDate(updatedVal, timeZone, 'yyyy-MM-dd HH:mm:ss');
      }
      
      reportsMap[dateStr] = {
        reportDate: dateStr,
        totalMale: Number(r[1]) || 0,
        totalFemale: Number(r[2]) || 0,
        thaiMale: Number(r[3]) || 0,
        thaiFemale: Number(r[4]) || 0,
        genMale: Number(r[5]) || 0,
        genFemale: Number(r[6]) || 0,
        procMale: Number(r[7]) || 0,
        procFemale: Number(r[8]) || 0,
        refillMale: Number(r[9]) || 0,
        refillFemale: Number(r[10]) || 0,
        referDocMale: Number(r[11]) || 0,
        referDocFemale: Number(r[12]) || 0,
        admitMale: Number(r[13]) || 0,
        admitFemale: Number(r[14]) || 0,
        referOutMale: Number(r[15]) || 0,
        referOutFemale: Number(r[16]) || 0,
        topDiseases: topDiseases,
        topProcedures: topProcedures,
        reporterNote: r[19] ? String(r[19]) : '',
        updatedAt: updatedVal ? String(updatedVal) : ''
      };
    }
    
    return JSON.stringify(reportsMap);
  } catch (error) {
    return JSON.stringify({});
  }
}

/**
 * 4. ฟังก์ชันลบข้อมูลรายงานตามวันที่กำหนด
 * @param {string} dateStr วันที่ต้องการลบ (รูปแบบ YYYY-MM-DD)
 */
function deleteReportData(dateStr) {
  try {
    var sheet = getOrCreateSheet();
    var rows = sheet.getDataRange().getValues();
    var timeZone = Session.getScriptTimeZone() || "Asia/Bangkok";
    for (var i = 1; i < rows.length; i++) {
      var d = rows[i][0];
      var formattedD = normalizeDateString(d, timeZone);
      if (formattedD === dateStr) {
        sheet.deleteRow(i + 1);
        return { status: 'success' };
      }
    }
    return { status: 'not_found' };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

/**
 * 5. ฟังก์ชันช่วยแปลงรูปแบบวันที่ให้อยู่ในรูปแบบ YYYY-MM-DD เสมอ
 */
function normalizeDateString(d, timeZone) {
  if (!d) return '';
  if (d instanceof Date) {
    return Utilities.formatDate(d, timeZone, 'yyyy-MM-dd');
  }
  var str = d.toString().trim();
  if (str.indexOf('T') !== -1) {
    str = str.split('T')[0];
  }
  if (/^\\d{4}-\\d{2}-\\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  return str;
}

/**
 * 6. ฟังก์ชันอัตโนมัติ: ค้นหาหรือสร้างตารางชื่อ 'DailyReports' พร้อมตั้งค่าหัวตารางให้อัตโนมัติ
 */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = 'DailyReports';
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      'ReportDate', 'TotalMale', 'TotalFemale', 'ThaiMale', 'ThaiFemale',
      'GenMale', 'GenFemale', 'ProcMale', 'ProcFemale', 'RefillMale', 'RefillFemale',
      'ReferDocMale', 'ReferDocFemale', 'AdmitMale', 'AdmitFemale', 'ReferOutMale', 'ReferOutFemale',
      'TopDiseasesJson', 'TopProceduresJson', 'ReporterNote', 'UpdatedAt'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#0d9488')
         .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
`;

export const STANDALONE_INDEX_HTML = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard ผู้ใช้บริการ หน่วยบริการชั่วคราว รพ.องครักษ์</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;600;700&family=JetBrains+Mono:wght@400;600&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Sarabun', sans-serif; background-color: #f8fafc; color: #0f172a; }
    h1, h2, h3, .font-display { font-family: 'Anuphan', sans-serif; }
    .tabular-nums { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
    <div class="font-display font-bold text-lg text-slate-900">รพ.องครักษ์ · หน่วยบริการชั่วคราว</div>
    <div class="flex items-center gap-4 text-sm font-medium">
      <button onclick="switchTab('dashboard')" id="tab-dashboard" class="text-teal-700 border-b-2 border-teal-600 pb-1">ภาพรวมสถิติ</button>
      <button onclick="switchTab('form')" id="tab-form" class="text-slate-600 hover:text-slate-900 pb-1">บันทึกข้อมูลประจำวัน</button>
      <button onclick="switchTab('table')" id="tab-table" class="text-slate-600 hover:text-slate-900 pb-1">ตารางข้อมูลย้อนหลัง</button>
    </div>
    <div>
      <button onclick="loadFromServer()" class="px-3.5 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">รีเฟรชข้อมูล</button>
    </div>
  </header>

  <main class="max-w-7xl w-full mx-auto px-6 py-8 flex-1">
    <div id="status-banner" class="hidden mb-6 p-4 rounded-lg border text-sm"></div>

    <!-- View 1: Dashboard -->
    <section id="view-dashboard" class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">รายงานสถิติผู้รับบริการ หน่วยบริการชั่วคราว รพ.องครักษ์</h1>
          <p class="text-sm text-slate-500 mt-1" id="summary-subtitle">กำลังโหลดข้อมูลจาก Google Sheet...</p>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-slate-500">เลือกวันที่ดูข้อมูล:</label>
          <select id="date-filter" onchange="renderDashboard()" class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="ALL">รวมทุกวันทั้งหมด</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4" id="kpi-grid"></div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white border border-slate-200 rounded-xl p-5">
          <h3 class="font-bold text-slate-900 mb-4">จำนวนผู้รับบริการแยกตามประเภทบริการ</h3>
          <div id="service-breakdown" class="space-y-3 text-sm"></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
          <div>
            <h3 class="font-bold text-slate-900 mb-3">5 อันดับโรคที่พบบ่อย (Top 5 Diseases)</h3>
            <div id="top-diseases-list" class="space-y-2 text-sm"></div>
          </div>
          <div class="border-t border-slate-100 pt-4">
            <h3 class="font-bold text-slate-900 mb-3">5 อันดับหัตถการ (Top 5 Procedures)</h3>
            <div id="top-procedures-list" class="space-y-2 text-sm"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- View 2: Form -->
    <section id="view-form" class="hidden max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div class="flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 class="text-xl font-bold text-slate-900">บันทึก/แก้ไขรายงานประจำวัน</h2>
        <input type="date" id="f-date" onchange="loadDateIntoForm()" class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm tabular-nums">
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm" id="form-fields"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
        <div>
          <h3 class="font-semibold text-slate-900 mb-2 text-sm">TOP 5 โรคที่พบบ่อย (ชื่อโรค และ จำนวน)</h3>
          <div id="f-diseases" class="space-y-2"></div>
        </div>
        <div>
          <h3 class="font-semibold text-slate-900 mb-2 text-sm">TOP 5 หัตถการ (ชื่อหัตถการ และ จำนวน)</h3>
          <div id="f-procedures" class="space-y-2"></div>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
        <textarea id="f-note" rows="2" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm"></textarea>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button onclick="submitForm()" id="btn-save" class="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700">บันทึกข้อมูลลง Google Sheet</button>
      </div>
    </section>

    <!-- View 3: Table -->
    <section id="view-table" class="hidden bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th class="py-3 px-4">วันที่รายงาน</th>
              <th class="py-3 px-4 text-right">รวม (ชาย/หญิง)</th>
              <th class="py-3 px-4 text-right">คนไทย</th>
              <th class="py-3 px-4 text-right">ตรวจโรคทั่วไป</th>
              <th class="py-3 px-4 text-right">หัตถการ</th>
              <th class="py-3 px-4 text-right">รับยาเดิม</th>
              <th class="py-3 px-4 text-right">ใบส่งตัว/Admit/Refer</th>
              <th class="py-3 px-4">หมายเหตุ</th>
              <th class="py-3 px-4 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody id="table-body" class="divide-y divide-slate-200"></tbody>
        </table>
      </div>
    </section>
  </main>

  <script>
    var reportsMap = {};
    var fieldPairs = [
      { label: 'ผู้รับบริการทั้งหมด', m: 'totalMale', f: 'totalFemale' },
      { label: 'สัญชาติไทย', m: 'thaiMale', f: 'thaiFemale' },
      { label: 'ตรวจโรคทั่วไป', m: 'genMale', f: 'genFemale' },
      { label: 'ทำหัตถการ', m: 'procMale', f: 'procFemale' },
      { label: 'รับยาต่อเนื่อง', m: 'refillMale', f: 'refillFemale' },
      { label: 'ขอใบส่งตัว', m: 'referDocMale', f: 'referDocFemale' },
      { label: 'รับไว้รักษา (Admit)', m: 'admitMale', f: 'admitFemale' },
      { label: 'ส่งต่อ (Refer Out)', m: 'referOutMale', f: 'referOutFemale' }
    ];

    function initFormDOM() {
      var container = document.getElementById('form-fields');
      container.innerHTML = fieldPairs.map(function(fp) {
        return '<div class="p-3 border border-slate-200 rounded-lg">' +
          '<div class="font-medium text-slate-800 mb-2">' + fp.label + '</div>' +
          '<div class="grid grid-cols-2 gap-2">' +
            '<div><label class="text-xs text-slate-500">ชาย</label><input type="number" min="0" id="f-' + fp.m + '" value="0" class="w-full border border-slate-300 rounded px-2 py-1 tabular-nums"></div>' +
            '<div><label class="text-xs text-slate-500">หญิง</label><input type="number" min="0" id="f-' + fp.f + '" value="0" class="w-full border border-slate-300 rounded px-2 py-1 tabular-nums"></div>' +
          '</div></div>';
      }).join('');

      var disHTML = '', procHTML = '';
      for (var i = 0; i < 5; i++) {
        disHTML += '<div class="flex gap-2"><input type="text" id="dis-name-' + i + '" placeholder="อันดับ ' + (i+1) + ' ชื่อโรค" class="flex-1 border border-slate-300 rounded px-2.5 py-1 text-sm"><input type="number" min="0" id="dis-cnt-' + i + '" placeholder="จำนวน" class="w-24 border border-slate-300 rounded px-2 py-1 text-sm tabular-nums"></div>';
        procHTML += '<div class="flex gap-2"><input type="text" id="proc-name-' + i + '" placeholder="อันดับ ' + (i+1) + ' หัตถการ" class="flex-1 border border-slate-300 rounded px-2.5 py-1 text-sm"><input type="number" min="0" id="proc-cnt-' + i + '" placeholder="จำนวน" class="w-24 border border-slate-300 rounded px-2 py-1 text-sm tabular-nums"></div>';
      }
      document.getElementById('f-diseases').innerHTML = disHTML;
      document.getElementById('f-procedures').innerHTML = procHTML;
      document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
    }

    function switchTab(tab) {
      ['dashboard', 'form', 'table'].forEach(function(t) {
        document.getElementById('view-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('tab-' + t).className = (t === tab)
          ? 'text-teal-700 border-b-2 border-teal-600 pb-1 font-semibold'
          : 'text-slate-600 hover:text-slate-900 pb-1';
      });
    }

    function showBanner(msg, isError) {
      var b = document.getElementById('status-banner');
      b.textContent = msg;
      b.className = 'mb-6 p-3.5 rounded-lg border text-sm ' + (isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-teal-50 border-teal-200 text-teal-800');
      setTimeout(function() { b.classList.add('hidden'); }, 4000);
    }

    function loadFromServer() {
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(function(jsonStr) {
          reportsMap = JSON.parse(jsonStr || '{}');
          populateDateDropdown();
          renderDashboard();
          renderTable();
          loadDateIntoForm();
        }).getReportsData();
      } else {
        document.getElementById('summary-subtitle').textContent = 'โหมดพรีวิว (เชื่อมต่อ Google Apps Script อัตโนมัติเมื่อรันบน Web App)';
        renderDashboard();
      }
    }

    function populateDateDropdown() {
      var sel = document.getElementById('date-filter');
      var current = sel.value;
      var dates = Object.keys(reportsMap).sort().reverse();
      sel.innerHTML = '<option value="ALL">รวมทุกวัน (' + dates.length + ' วัน)</option>' +
        dates.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
      if (dates.indexOf(current) !== -1 || current === 'ALL') sel.value = current;
    }

    function renderDashboard() {
      var filter = document.getElementById('date-filter').value;
      var list = filter === 'ALL' ? Object.values(reportsMap) : (reportsMap[filter] ? [reportsMap[filter]] : []);
      document.getElementById('summary-subtitle').textContent = filter === 'ALL'
        ? 'ข้อมูลสะสมทั้งหมด ' + list.length + ' วันทำการ'
        : 'ข้อมูลประจำวันที่ ' + filter;

      var sum = {};
      fieldPairs.forEach(function(fp) { sum[fp.m] = 0; sum[fp.f] = 0; });
      var disMap = {}, procMap = {};

      list.forEach(function(r) {
        fieldPairs.forEach(function(fp) {
          sum[fp.m] += Number(r[fp.m]) || 0;
          sum[fp.f] += Number(r[fp.f]) || 0;
        });
        (r.topDiseases || []).forEach(function(d) {
          if (d && d.name) disMap[d.name] = (disMap[d.name] || 0) + (Number(d.count || d.total) || 0);
        });
        (r.topProcedures || []).forEach(function(p) {
          if (p && p.name) procMap[p.name] = (procMap[p.name] || 0) + (Number(p.count || p.total) || 0);
        });
      });

      var totalAll = sum.totalMale + sum.totalFemale;
      var totalThai = sum.thaiMale + sum.thaiFemale;
      var totalGen = sum.genMale + sum.genFemale;
      var totalProcRefill = sum.procMale + sum.procFemale + sum.refillMale + sum.refillFemale;

      document.getElementById('kpi-grid').innerHTML = [
        { title: 'ผู้รับบริการทั้งหมด', val: totalAll, sub: 'ชาย ' + sum.totalMale + ' · หญิง ' + sum.totalFemale },
        { title: 'สัญชาติไทย', val: totalThai, sub: 'ชาย ' + sum.thaiMale + ' · หญิง ' + sum.thaiFemale + ' · ต่างชาติ ' + Math.max(0, totalAll - totalThai) },
        { title: 'ตรวจโรคทั่วไป (OPD)', val: totalGen, sub: 'ชาย ' + sum.genMale + ' · หญิง ' + sum.genFemale },
        { title: 'หัตถการ + รับยาเดิม', val: totalProcRefill, sub: 'หัตถการ ' + (sum.procMale + sum.procFemale) + ' · รับยา ' + (sum.refillMale + sum.refillFemale) }
      ].map(function(k) {
        return '<div class="bg-white border border-slate-200 rounded-xl p-5">' +
          '<div class="text-xs text-slate-500">' + k.title + '</div>' +
          '<div class="text-3xl font-bold text-slate-900 tabular-nums mt-1">' + k.val.toLocaleString() + '</div>' +
          '<div class="text-xs text-slate-500 mt-2 tabular-nums">' + k.sub + '</div></div>';
      }).join('');

      document.getElementById('service-breakdown').innerHTML = fieldPairs.slice(2).map(function(fp) {
        var m = sum[fp.m], f = sum[fp.f], tot = m + f;
        return '<div class="flex items-center justify-between py-2 border-b border-slate-100">' +
          '<span class="font-medium text-slate-700">' + fp.label + '</span>' +
          '<span class="tabular-nums text-slate-900 font-semibold">' + tot + ' <span class="text-xs font-normal text-slate-500">(ช ' + m + ' / ญ ' + f + ')</span></span></div>';
      }).join('');

      var topDis = Object.entries(disMap).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
      var topProc = Object.entries(procMap).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

      document.getElementById('top-diseases-list').innerHTML = topDis.length ? topDis.map(function(item, idx) {
        return '<div class="flex justify-between py-1"><span class="text-slate-700">' + (idx+1) + '. ' + item[0] + '</span><span class="tabular-nums font-semibold">' + item[1] + ' ราย</span></div>';
      }).join('') : '<div class="text-slate-400">ยังไม่มีข้อมูล</div>';

      document.getElementById('top-procedures-list').innerHTML = topProc.length ? topProc.map(function(item, idx) {
        return '<div class="flex justify-between py-1"><span class="text-slate-700">' + (idx+1) + '. ' + item[0] + '</span><span class="tabular-nums font-semibold">' + item[1] + ' ครั้ง</span></div>';
      }).join('') : '<div class="text-slate-400">ยังไม่มีข้อมูล</div>';
    }

    function loadDateIntoForm() {
      var d = document.getElementById('f-date').value;
      var rec = reportsMap[d] || {};
      fieldPairs.forEach(function(fp) {
        document.getElementById('f-' + fp.m).value = rec[fp.m] || 0;
        document.getElementById('f-' + fp.f).value = rec[fp.f] || 0;
      });
      var dis = rec.topDiseases || [];
      var proc = rec.topProcedures || [];
      for (var i = 0; i < 5; i++) {
        document.getElementById('dis-name-' + i).value = dis[i] ? dis[i].name : '';
        document.getElementById('dis-cnt-' + i).value = dis[i] ? (dis[i].count || dis[i].total || 0) : '';
        document.getElementById('proc-name-' + i).value = proc[i] ? proc[i].name : '';
        document.getElementById('proc-cnt-' + i).value = proc[i] ? (proc[i].count || proc[i].total || 0) : '';
      }
      document.getElementById('f-note').value = rec.reporterNote || '';
    }

    function submitForm() {
      var payload = { reportDate: document.getElementById('f-date').value, topDiseases: [], topProcedures: [] };
      fieldPairs.forEach(function(fp) {
        payload[fp.m] = Number(document.getElementById('f-' + fp.m).value) || 0;
        payload[fp.f] = Number(document.getElementById('f-' + fp.f).value) || 0;
      });
      for (var i = 0; i < 5; i++) {
        var dn = document.getElementById('dis-name-' + i).value.trim();
        var dc = Number(document.getElementById('dis-cnt-' + i).value) || 0;
        if (dn) payload.topDiseases.push({ name: dn, count: dc });
        var pn = document.getElementById('proc-name-' + i).value.trim();
        var pc = Number(document.getElementById('proc-cnt-' + i).value) || 0;
        if (pn) payload.topProcedures.push({ name: pn, count: pc });
      }
      payload.reporterNote = document.getElementById('f-note').value.trim();

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        document.getElementById('btn-save').textContent = 'กำลังบันทึก...';
        google.script.run.withSuccessHandler(function(res) {
          document.getElementById('btn-save').textContent = 'บันทึกข้อมูลลง Google Sheet';
          if (res && res.status === 'success') {
            showBanner('บันทึกข้อมูลวันที่ ' + payload.reportDate + ' เรียบร้อยแล้ว', false);
            loadFromServer();
            switchTab('dashboard');
          } else {
            showBanner('เกิดข้อผิดพลาด: ' + (res ? res.message : ''), true);
          }
        }).saveReportData(JSON.stringify(payload));
      }
    }

    function renderTable() {
      var dates = Object.keys(reportsMap).sort().reverse();
      document.getElementById('table-body').innerHTML = dates.map(function(d) {
        var r = reportsMap[d];
        var tot = (r.totalMale || 0) + (r.totalFemale || 0);
        return '<tr class="hover:bg-slate-50">' +
          '<td class="py-3 px-4 font-medium tabular-nums">' + d + '</td>' +
          '<td class="py-3 px-4 text-right tabular-nums font-semibold">' + tot + ' (' + r.totalMale + '/' + r.totalFemale + ')</td>' +
          '<td class="py-3 px-4 text-right tabular-nums">' + ((r.thaiMale||0)+(r.thaiFemale||0)) + '</td>' +
          '<td class="py-3 px-4 text-right tabular-nums">' + ((r.genMale||0)+(r.genFemale||0)) + '</td>' +
          '<td class="py-3 px-4 text-right tabular-nums">' + ((r.procMale||0)+(r.procFemale||0)) + '</td>' +
          '<td class="py-3 px-4 text-right tabular-nums">' + ((r.refillMale||0)+(r.refillFemale||0)) + '</td>' +
          '<td class="py-3 px-4 text-right tabular-nums">' + ((r.referDocMale||0)+(r.referDocFemale||0)) + ' / ' + ((r.admitMale||0)+(r.admitFemale||0)) + ' / ' + ((r.referOutMale||0)+(r.referOutFemale||0)) + '</td>' +
          '<td class="py-3 px-4 text-slate-500 truncate max-w-xs">' + (r.reporterNote || '-') + '</td>' +
          '<td class="py-3 px-4 text-right space-x-2">' +
            '<button onclick="editDate(\\'' + d + '\\')" class="text-teal-600 hover:underline text-xs">แก้ไข</button>' +
            '<button onclick="removeDate(\\'' + d + '\\')" class="text-red-600 hover:underline text-xs">ลบ</button>' +
          '</td></tr>';
      }).join('');
    }

    function editDate(d) {
      document.getElementById('f-date').value = d;
      loadDateIntoForm();
      switchTab('form');
    }

    function removeDate(d) {
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(function() {
          showBanner('ลบข้อมูลวันที่ ' + d + ' เรียบร้อยแล้ว', false);
          loadFromServer();
        }).deleteReportData(d);
      }
    }

    initFormDOM();
    loadFromServer();
  </script>
</body>
</html>`;
