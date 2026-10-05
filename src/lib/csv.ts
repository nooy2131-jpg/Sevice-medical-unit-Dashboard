// Use the browser entry points because this module is imported by client components.
// The regular sync entry points pull Node stream/buffer dependencies into the client bundle.
import { parse as parseCsv } from 'csv-parse/browser/esm/sync';
import { stringify as stringifyCsv } from 'csv-stringify/browser/esm/sync';
import type { ReportPayload } from './report-validation';

const HEADERS = [
  'ReportDate', 'TotalMale', 'TotalFemale', 'ThaiMale', 'ThaiFemale', 'GenMale', 'GenFemale',
  'ProcMale', 'ProcFemale', 'RefillMale', 'RefillFemale', 'ReferDocMale', 'ReferDocFemale',
  'AdmitMale', 'AdmitFemale', 'ReferOutMale', 'ReferOutFemale', 'TopDiseasesJson', 'TopProceduresJson',
  'ReporterNote', 'UpdatedAt',
] as const;
const REQUIRED_HEADERS = HEADERS.filter((header) => header !== 'UpdatedAt');

const COUNT_FIELDS = [
  'totalMale', 'totalFemale', 'thaiMale', 'thaiFemale', 'genMale', 'genFemale', 'procMale', 'procFemale',
  'refillMale', 'refillFemale', 'referDocMale', 'referDocFemale', 'admitMale', 'admitFemale', 'referOutMale', 'referOutFemale',
] as const satisfies readonly (keyof ReportPayload)[];

type CsvReport = Pick<ReportPayload, 'reportDate' | typeof COUNT_FIELDS[number] | 'topDiseases' | 'topProcedures' | 'reporterNote' | 'updatedAt'>;

const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

function unprotectFormula(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  // Exported formula values have one apostrophe; a literal apostrophe before a
  // formula-leading value is doubled so the round trip stays lossless.
  if (/^''/.test(value)) return value.slice(1);
  if (!value.startsWith("'")) return value;
  return FORMULA_PREFIX.test(value.slice(1)) ? value.slice(1) : value;
}

function protectFormula(value: unknown): unknown {
  const text = String(value ?? '');
  // Prefix every leading apostrophe as well as formula-leading text. This
  // makes the protective prefix count explicit and keeps arbitrary literal
  // apostrophes reversible across export/import.
  return FORMULA_PREFIX.test(text) || text.startsWith("'")
    ? `'${text}`
    : value;
}

function parseJsonCell(value: unknown): unknown {
  if (typeof value !== 'string' || value.trim() === '') return [];
  return JSON.parse(value);
}

type CsvColumn = (typeof HEADERS)[number];

function columnMap(rawHeaders: unknown[]): Map<CsvColumn, number> {
  const columns = new Map<CsvColumn, number>();
  rawHeaders.forEach((rawHeader, index) => {
    const header = typeof rawHeader === 'string' ? rawHeader.trim() : '';
    if (!HEADERS.includes(header as CsvColumn)) {
      throw new Error(`CSV header is not supported: ${String(rawHeader ?? '')}`);
    }
    const column = header as CsvColumn;
    if (columns.has(column)) throw new Error(`CSV header is duplicated: ${column}`);
    columns.set(column, index);
  });
  for (const required of REQUIRED_HEADERS) {
    if (!columns.has(required)) throw new Error(`CSV header is missing required column: ${required}`);
  }
  return columns;
}

function rowToReport(row: unknown[], columns: ReadonlyMap<CsvColumn, number>): Record<string, unknown> {
  const values = row.map(unprotectFormula);
  const valueAt = (column: CsvColumn): unknown => {
    const index = columns.get(column);
    return index === undefined ? undefined : values[index];
  };
  const report: Record<string, unknown> = {
    reportDate: String(valueAt('ReportDate') ?? '').trim(),
    topDiseases: valueAt('TopDiseasesJson') === undefined ? undefined : parseJsonCell(valueAt('TopDiseasesJson')),
    topProcedures: valueAt('TopProceduresJson') === undefined ? undefined : parseJsonCell(valueAt('TopProceduresJson')),
    reporterNote: valueAt('ReporterNote') === undefined ? undefined : String(valueAt('ReporterNote')),
    updatedAt: valueAt('UpdatedAt') === undefined ? undefined : String(valueAt('UpdatedAt')),
  };
  COUNT_FIELDS.forEach((field, index) => {
    const raw = valueAt(HEADERS[index + 1]);
    // Keep absent cells absent and leave malformed cells untouched. The preview
    // validator can then distinguish an explicit blank from a bad value.
    if (raw === undefined) {
      report[field] = undefined;
    } else if (raw === '') {
      report[field] = '';
    } else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
      report[field] = Number(raw);
    } else {
      report[field] = raw;
    }
  });
  return report;
}

/** Parse legacy JSON maps/arrays and the exported CSV/TSV format. Validation belongs to report-validation. */
export function parseImportText(input: string): unknown[] {
  const text = input.replace(/^\uFEFF/, '');
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Import is empty');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) return Object.values(parsed);
    throw new Error('JSON import must be an array or object map');
  }
  const delimiter = text.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ',';
  const rows: unknown[][] = parseCsv(text, { bom: true, delimiter, relax_quotes: true, skip_empty_lines: true, record_delimiter: ['\r\n', '\n', '\r'] });
  if (rows.length < 2) throw new Error('CSV import must include a header and at least one row');
  const columns = columnMap(rows[0]);
  return rows.slice(1).map((row) => {
    if (row.length > rows[0].length) throw new Error('CSV row has more columns than its header');
    return rowToReport(row, columns);
  });
}

export function stringifyReportsCsv(reports: readonly CsvReport[]): string {
  const records = reports.map((report) => [
    report.reportDate, ...COUNT_FIELDS.map((field) => report[field]), JSON.stringify(report.topDiseases), JSON.stringify(report.topProcedures),
    report.reporterNote, report.updatedAt ?? '',
  ].map(protectFormula));
  return `\uFEFF${stringifyCsv([HEADERS, ...records], { quoted: true, record_delimiter: '\n' })}`;
}

// Keep the names used by the client components stable while retaining the
// descriptive names used by the API and tests.
export const parseReportsImport = parseImportText;
export const exportReportsCsv = stringifyReportsCsv;

export { HEADERS as REPORT_CSV_HEADERS };
