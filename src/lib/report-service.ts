import { prisma } from './db';
import type { Prisma, PrismaClient } from '@/src/generated/prisma/client';
import { HttpError } from './http';
import { assertCalendarDate } from './dates';
import { type ReportPayload, validateExpectedDraftRevision, validateExpectedVersion, validateReport } from './report-validation';

type Actor = { id: string; email: string; name: string | null; role: string };

type Row = Record<string, unknown>;
const database: PrismaClient = prisma;

export type PublishedReport = ReportPayload & {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastEditor: { id: string; email: string; name: string | null } | null;
};

export type PrivateDraft = {
  reportDate: string;
  data: ReportPayload;
  expectedVersion: number;
  revision: number;
  updatedAt: string;
};

function row(value: unknown, label: string): Row {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Invalid ${label} returned by database`);
  return value as Row;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${label} returned by database`);
  return value;
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== 'number') throw new Error(`Invalid ${label} returned by database`);
  return value;
}

function isoDate(value: unknown, label: string): string {
  if (!(value instanceof Date)) throw new Error(`Invalid ${label} returned by database`);
  return value.toISOString();
}

function payloadFromRow(value: unknown): ReportPayload {
  const data = row(value, 'report data').data;
  return validateReport(data);
}

function mapPublished(value: unknown): PublishedReport {
  const source = row(value, 'daily report');
  if (source.deletedAt instanceof Date) throw new Error('A deleted report cannot be returned as published');
  const editor = source.updatedBy;
  const mappedEditor = editor === null || editor === undefined ? null : (() => {
    const user = row(editor, 'report editor');
    return { id: stringValue(user.id, 'editor id'), email: stringValue(user.email, 'editor email'), name: typeof user.name === 'string' ? user.name : null };
  })();
  const data = payloadFromRow(source);
  return {
    ...data,
    id: stringValue(source.id, 'report id'),
    version: numberValue(source.version, 'report version'),
    createdAt: isoDate(source.createdAt, 'report createdAt'),
    updatedAt: isoDate(source.updatedAt, 'report updatedAt'),
    lastEditor: mappedEditor,
  };
}

function mapDraft(value: unknown): PrivateDraft {
  const source = row(value, 'draft');
  const reportDate = stringValue(source.reportDate, 'draft reportDate');
  return {
    reportDate,
    data: validateReport(source.data),
    expectedVersion: numberValue(source.expectedVersion, 'draft expectedVersion'),
    revision: numberValue(source.revision, 'draft revision'),
    updatedAt: isoDate(source.updatedAt, 'draft updatedAt'),
  };
}

function conflict(message = 'The report changed since it was loaded.') {
  return new HttpError(409, 'VERSION_CONFLICT', message);
}

function reportCreateData(report: ReportPayload, actor: Actor): Prisma.DailyReportUncheckedCreateInput {
  return {
    reportDate: report.reportDate,
    data: report as unknown as Prisma.InputJsonValue,
    version: 1,
    createdById: actor.id,
    updatedById: actor.id,
  };
}

function auditData(actor: Actor, action: string, entityId: string, data?: Record<string, unknown>): Prisma.AuditLogUncheckedCreateInput {
  return { actorId: actor.id, action, entityId, ...(data === undefined ? {} : { data: data as unknown as Prisma.InputJsonValue }) };
}

export async function listReports(): Promise<PublishedReport[]> {
  const result = await database.dailyReport.findMany({ where: { deletedAt: null }, orderBy: { reportDate: 'asc' }, include: { updatedBy: true } });
  if (!Array.isArray(result)) throw new Error('Invalid reports returned by database');
  return result.map(mapPublished);
}

export async function findReport(reportDate: string): Promise<PublishedReport | null> {
  assertCalendarDate(reportDate);
  const result = await database.dailyReport.findFirst({ where: { reportDate, deletedAt: null }, include: { updatedBy: true } });
  return result === null ? null : mapPublished(result);
}

export async function saveReport(rawReport: unknown, rawExpectedVersion: unknown, actor: Actor): Promise<PublishedReport> {
  const report = validateReport(rawReport);
  const expectedVersion = validateExpectedVersion(rawExpectedVersion);
  try {
    return await database.$transaction(async (tx) => {
      let reportRow: unknown;
      let action = 'report.updated';
      if (expectedVersion === 0) {
        const existing = await tx.dailyReport.findUnique({ where: { reportDate: report.reportDate }, select: { version: true, deletedAt: true } });
        if (existing === null) {
          reportRow = await tx.dailyReport.create({ data: reportCreateData(report, actor), include: { updatedBy: true } });
          action = 'report.created';
        } else {
          const tombstone = row(existing, 'report tombstone');
          if (!(tombstone.deletedAt instanceof Date)) throw conflict('A report for this date already exists.');
          const revived = await tx.dailyReport.updateMany({
            where: { reportDate: report.reportDate, version: numberValue(tombstone.version, 'report version'), deletedAt: { not: null } },
            data: { data: report as unknown as Prisma.InputJsonValue, version: { increment: 1 }, deletedAt: null, updatedById: actor.id },
          });
          if (revived.count !== 1) throw conflict('A report for this date changed while it was being restored.');
          reportRow = await tx.dailyReport.findUnique({ where: { reportDate: report.reportDate }, include: { updatedBy: true } });
          action = 'report.resurrected';
        }
      } else {
        const changed = await tx.dailyReport.updateMany({
          where: { reportDate: report.reportDate, version: expectedVersion, deletedAt: null },
          data: { data: report as unknown as Prisma.InputJsonValue, version: { increment: 1 }, updatedById: actor.id },
        });
        if (changed.count !== 1) throw conflict();
        reportRow = await tx.dailyReport.findUnique({ where: { reportDate: report.reportDate }, include: { updatedBy: true } });
      }
      const mapped = mapPublished(reportRow);
      await tx.auditLog.create({ data: auditData(actor, action, mapped.id, { reportDate: report.reportDate, version: mapped.version }) });
      return mapped;
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const source = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
    if (expectedVersion === 0 && source.code === 'P2002') throw conflict('A report for this date changed while it was being created.');
    throw error;
  }
}

export async function deleteReport(reportDate: string, rawExpectedVersion: unknown, actor: Actor): Promise<void> {
  assertCalendarDate(reportDate);
  const expectedVersion = validateExpectedVersion(rawExpectedVersion);
  await database.$transaction(async (tx) => {
    const existing = await tx.dailyReport.findUnique({ where: { reportDate }, select: { id: true, version: true, deletedAt: true } });
    if (existing === null) throw new HttpError(404, 'REPORT_NOT_FOUND', 'No report exists for this date.');
    const existingRow = row(existing, 'report');
    if (existingRow.deletedAt instanceof Date) throw new HttpError(404, 'REPORT_NOT_FOUND', 'No report exists for this date.');
    const deletedAt = new Date();
    const deleted = await tx.dailyReport.updateMany({
      where: { reportDate, version: expectedVersion, deletedAt: null },
      data: { deletedAt, version: { increment: 1 }, updatedById: actor.id },
    });
    if (deleted.count !== 1) throw conflict();
    await tx.auditLog.create({ data: auditData(actor, 'report.deleted', stringValue(existingRow.id, 'report id'), { reportDate, version: expectedVersion, deletedAt: deletedAt.toISOString() }) });
  });
}

export async function getDraft(reportDate: string, actor: Actor): Promise<PrivateDraft | null> {
  assertCalendarDate(reportDate);
  const result = await database.draft.findUnique({ where: { userId_reportDate: { userId: actor.id, reportDate } } });
  return result === null ? null : mapDraft(result);
}

export async function saveDraft(reportDate: string, rawData: unknown, rawExpectedVersion: unknown, rawExpectedDraftRevision: unknown, actor: Actor): Promise<PrivateDraft> {
  assertCalendarDate(reportDate);
  const data = validateReport(rawData);
  if (data.reportDate !== reportDate) throw new HttpError(400, 'DATE_MISMATCH', 'Draft reportDate must match the URL date.');
  const expectedVersion = validateExpectedVersion(rawExpectedVersion);
  const expectedDraftRevision = validateExpectedDraftRevision(rawExpectedDraftRevision);
  let saved: unknown;
  try {
    saved = await database.$transaction(async (tx) => {
      const existing = await tx.draft.findUnique({ where: { userId_reportDate: { userId: actor.id, reportDate } } });
      if (existing === null) {
        if (expectedDraftRevision !== 0) throw conflict('The draft no longer exists.');
        return tx.draft.create({ data: { userId: actor.id, reportDate, data: data as unknown as Prisma.InputJsonValue, expectedVersion, revision: 1 }, });
      }
      const changed = await tx.draft.updateMany({
        where: { userId: actor.id, reportDate, revision: expectedDraftRevision },
        data: { data: data as unknown as Prisma.InputJsonValue, expectedVersion, revision: { increment: 1 } },
      });
      if (changed.count !== 1) throw conflict('This draft changed in another tab.');
      return tx.draft.findUnique({ where: { userId_reportDate: { userId: actor.id, reportDate } } });
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const source = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
    if (source.code === 'P2002') throw conflict('A draft for this date was created in another tab.');
    throw error;
  }
  return mapDraft(saved);
}

export async function deleteDraft(reportDate: string, rawExpectedDraftRevision: unknown, actor: Actor): Promise<void> {
  assertCalendarDate(reportDate);
  const expectedDraftRevision = validateExpectedDraftRevision(rawExpectedDraftRevision);
  const deleted = await database.draft.deleteMany({ where: { userId: actor.id, reportDate, revision: expectedDraftRevision } });
  if (deleted.count === 0) {
    const existing = await database.draft.findUnique({ where: { userId_reportDate: { userId: actor.id, reportDate } }, select: { reportDate: true } });
    if (existing !== null) throw conflict('This draft was changed in another tab.');
  }
}

export type ImportMode = 'skip' | 'overwrite';
export type ImportInput = { reports: unknown[]; mode: ImportMode; expectedVersions: Record<string, number> };

export async function importReports(input: ImportInput, actor: Actor): Promise<{ reports: PublishedReport[]; skipped: string[] }> {
  if (!Array.isArray(input.reports) || input.reports.length > 5_000) throw new HttpError(400, 'INVALID_IMPORT', 'Import must contain between 1 and 5,000 reports.');
  if (input.mode !== 'skip' && input.mode !== 'overwrite') throw new HttpError(400, 'INVALID_IMPORT_MODE', 'Import mode must be skip or overwrite.');
  const reports = input.reports.map(validateReport);
  const dates = new Set<string>();
  for (const report of reports) {
    if (dates.has(report.reportDate)) throw new HttpError(400, 'DUPLICATE_IMPORT_DATE', `Import contains duplicate date ${report.reportDate}.`);
    dates.add(report.reportDate);
  }
  for (const date of dates) {
    const value = input.expectedVersions[date];
    if (value !== undefined) validateExpectedVersion(value);
  }
  return database.$transaction(async (tx) => {
    const imported: PublishedReport[] = [];
    const skipped: string[] = [];
    for (const report of reports) {
      const current = await tx.dailyReport.findUnique({ where: { reportDate: report.reportDate }, include: { updatedBy: true } });
      const currentRow = current === null ? null : row(current, 'import report');
      const isTombstone = currentRow !== null && currentRow.deletedAt instanceof Date;
      if (current !== null && !isTombstone && input.mode === 'skip') {
        skipped.push(report.reportDate);
        continue;
      }
      const expectedVersion = input.expectedVersions[report.reportDate] ?? 0;
      let saved: unknown;
      let action = 'report.imported';
      if (current === null) {
        if (expectedVersion !== 0) throw conflict(`No current report exists for ${report.reportDate}.`);
        saved = await tx.dailyReport.create({ data: reportCreateData(report, actor), include: { updatedBy: true } });
      } else if (currentRow !== null && isTombstone) {
        if (expectedVersion !== 0) throw conflict(`Deleted report ${report.reportDate} must be imported as a new report.`);
        const restored = await tx.dailyReport.updateMany({
          where: { reportDate: report.reportDate, version: numberValue(currentRow.version, 'report version'), deletedAt: { not: null } },
          data: { data: report as unknown as Prisma.InputJsonValue, version: { increment: 1 }, deletedAt: null, updatedById: actor.id },
        });
        if (restored.count !== 1) throw conflict(`Report ${report.reportDate} changed during import.`);
        saved = await tx.dailyReport.findUnique({ where: { reportDate: report.reportDate }, include: { updatedBy: true } });
        action = 'report.import.resurrected';
      } else {
        const changed = await tx.dailyReport.updateMany({ where: { reportDate: report.reportDate, version: expectedVersion, deletedAt: null }, data: { data: report as unknown as Prisma.InputJsonValue, version: { increment: 1 }, updatedById: actor.id } });
        if (changed.count !== 1) throw conflict(`Report ${report.reportDate} changed during import.`);
        saved = await tx.dailyReport.findUnique({ where: { reportDate: report.reportDate }, include: { updatedBy: true } });
        action = 'report.import.overwritten';
      }
      const mapped = mapPublished(saved);
      imported.push(mapped);
      await tx.auditLog.create({ data: auditData(actor, action, mapped.id, { reportDate: report.reportDate, version: mapped.version }) });
    }
    return { reports: imported, skipped };
  });
}
