import { parse as parseCsv } from 'csv-parse/sync';
import { stringify as stringifyCsv } from 'csv-stringify/sync';
import type { ReportPayload } from './report-validation';

const HEADERS = [
  'ReportDate', 'TotalMale', 'TotalFemale', 'ThaiMale', 'ThaiFemale', 'GenMale', 'GenFemale',
  'ProcMale', 'ProcFemale', 'RefillMale', 'RefillFemale', 'ReferDocMale', 'ReferDocFemale',
  'AdmitMale', 'AdmitFemale', 'ReferOutMale', 'ReferOutFemale', 'TopDiseasesJson', 'TopProceduresJson',
  'ReporterNote', 'UpdatedAt',
] as const;

const COUNT_FIELDS: Array<keyof ReportPayload> = [
  'totalMale', 'totalFemale', 'thaiMale', 'thaiFemale', 'genMale', 'genFemale', 'procMale', 'procFemale',
  'refillMale', 'refillFemale', 'referDocMale', 'referDocFemale', 'admitMale', 'admitFemale', 'referOutMale', 'referOutFemale',
];

function unprotectFormula(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function protectFormula(value: unknown): unknown {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : value;
}

function parseJsonCell(value: unknown): unknown[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}

function rowToReport(row: unknown[]): Record<string, unknown> {
  const values = row.map(unprotectFormula);
  const report: Record<string, unknown> = {
    reportDate: String(values[0] ?? '').trim().slice(0, 10),
    topDiseases: parseJsonCell(values[17]),
    topProcedures: parseJsonCell(values[18]),
    reporterNote: String(values[19] ?? ''),
    updatedAt: String(values[20] ?? ''),
  };
  COUNT_FIELDS.forEach((field, index) => { report[field] = Number(values[index + 1] ?? 0); });
  return report;
}

/** Parse legacy JSON maps/arrays and the exported CSV/TSV format. Validation belongs to report-validation. */
export function parseImportText(input: string): unknown[] {
  const text = input.replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('Import is empty');
  if (text.startsWith('{') || text.startsWith('[')) {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) return Object.values(parsed);
    throw new Error('JSON import must be an array or object map');
  }
  const delimiter = text.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ',';
  const rows: unknown[][] = parseCsv(text, { bom: true, delimiter, relax_quotes: true, skip_empty_lines: true, record_delimiter: ['\r\n', '\n', '\r'] });
  if (rows.length < 2) throw new Error('CSV import must include a header and at least one row');
  return rows.slice(1).map((row) => rowToReport(row));
}

export function stringifyReportsCsv(reports: readonly ReportPayload[]): string {
  const records = reports.map((report) => [
    report.reportDate, ...COUNT_FIELDS.map((field) => report[field]), JSON.stringify(report.topDiseases), JSON.stringify(report.topProcedures),
    report.reporterNote, report.updatedAt ?? '',
  ].map(protectFormula));
  return `\uFEFF${stringifyCsv([HEADERS, ...records], { quoted: true, record_delimiter: '\n' })}`;
}

export { HEADERS as REPORT_CSV_HEADERS };
