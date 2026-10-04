import type { TopItem } from '../types/report';
import { isCalendarDate } from './dates';

export type ReportPayload = {
  reportDate: string;
  totalMale: number;
  totalFemale: number;
  thaiMale: number;
  thaiFemale: number;
  genMale: number;
  genFemale: number;
  procMale: number;
  procFemale: number;
  refillMale: number;
  refillFemale: number;
  referDocMale: number;
  referDocFemale: number;
  admitMale: number;
  admitFemale: number;
  referOutMale: number;
  referOutFemale: number;
  topDiseases: TopItem[];
  topProcedures: TopItem[];
  reporterNote: string;
  updatedAt?: string;
  version?: number;
  lastEditor?: { id: string; name: string | null; email: string } | null;
};

export const REPORT_COUNT_FIELDS = [
  'totalMale', 'totalFemale',
  'thaiMale', 'thaiFemale', 'genMale', 'genFemale',
  'procMale', 'procFemale', 'refillMale', 'refillFemale',
  'referDocMale', 'referDocFemale', 'admitMale', 'admitFemale',
  'referOutMale', 'referOutFemale',
] as const;

const MAX_NOTE_LENGTH = 10_000;
const MAX_ITEM_NAME_LENGTH = 240;
const MAX_ITEMS = 5;
const MAX_DATE_LENGTH = 10;

export type ValidationIssue = { path: string; message: string };

export class ReportValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'ReportValidationError';
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanOptionalCount(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    issues.push({ path, message: 'must be a finite non-negative integer' });
    return undefined;
  }
  return value;
}

function parseTopItems(value: unknown, path: string, issues: ValidationIssue[]): TopItem[] {
  if (!Array.isArray(value)) {
    issues.push({ path, message: 'must be an array' });
    return [];
  }
  if (value.length > MAX_ITEMS) issues.push({ path, message: `must contain at most ${MAX_ITEMS} items` });
  return value.slice(0, MAX_ITEMS).flatMap((raw, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(raw)) {
      issues.push({ path: itemPath, message: 'must be an object' });
      return [];
    }
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name || name.length > MAX_ITEM_NAME_LENGTH) {
      issues.push({ path: `${itemPath}.name`, message: `must be 1-${MAX_ITEM_NAME_LENGTH} characters` });
      return [];
    }
    const count = cleanOptionalCount(raw.count, `${itemPath}.count`, issues);
    const male = cleanOptionalCount(raw.male, `${itemPath}.male`, issues);
    const female = cleanOptionalCount(raw.female, `${itemPath}.female`, issues);
    return [{ name, count: count ?? ((male ?? 0) + (female ?? 0)), ...(male === undefined ? {} : { male }), ...(female === undefined ? {} : { female }) }];
  });
}

/** Validate and normalize the client report payload. Category sums intentionally are not compared to totals. */
export function validateReport(value: unknown): ReportPayload {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) throw new ReportValidationError([{ path: '', message: 'must be an object' }]);

  const reportDate = value.reportDate;
  if (!isCalendarDate(reportDate)) issues.push({ path: 'reportDate', message: 'must be a valid YYYY-MM-DD date' });
  else if (reportDate.length > MAX_DATE_LENGTH) issues.push({ path: 'reportDate', message: 'is too long' });

  const normalized: Record<string, unknown> = { reportDate };
  for (const field of REPORT_COUNT_FIELDS) {
    const raw = value[field];
    if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) {
      issues.push({ path: field, message: 'must be a finite non-negative integer' });
    } else normalized[field] = raw;
  }

  normalized.topDiseases = parseTopItems(value.topDiseases, 'topDiseases', issues);
  normalized.topProcedures = parseTopItems(value.topProcedures, 'topProcedures', issues);
  if (typeof value.reporterNote !== 'string' || value.reporterNote.length > MAX_NOTE_LENGTH) {
    issues.push({ path: 'reporterNote', message: `must be a string of at most ${MAX_NOTE_LENGTH} characters` });
  } else normalized.reporterNote = value.reporterNote;

  if (issues.length) throw new ReportValidationError(issues);
  return normalized as ReportPayload;
}

export function validateExpectedVersion(value: unknown): number {
  // The UI represents a not-yet-published report as null; normalize that to the
  // CAS sentinel used by the database while still rejecting omitted versions.
  if (value === null) return 0;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ReportValidationError([{ path: 'expectedVersion', message: 'must be a non-negative integer' }]);
  }
  return value;
}

export function validateExpectedDraftRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ReportValidationError([{ path: 'expectedDraftRevision', message: 'must be a non-negative integer' }]);
  }
  return value;
}

export function toReportPayload(data: unknown): ReportPayload {
  return validateReport(data);
}
