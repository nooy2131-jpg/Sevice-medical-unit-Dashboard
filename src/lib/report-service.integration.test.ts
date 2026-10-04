import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { prisma } from './db';
import { findReport, importReports, saveDraft, saveReport } from './report-service';
import type { ReportPayload } from './report-validation';

const canRun = process.env.OKR_RUN_DB_TESTS === '1' && /(?:localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL ?? '');
const suite = canRun ? describe : describe.skip;
const actor = { id: `integration-${crypto.randomUUID()}`, email: `integration-${crypto.randomUUID()}@example.invalid`, name: 'Integration Test', role: 'admin' as const };
const dates = [`2099-01-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`, `2099-02-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`];

function report(reportDate: string, totalMale: number): ReportPayload {
  return {
    reportDate, totalMale, totalFemale: 0, thaiMale: 0, thaiFemale: 0, genMale: 0, genFemale: 0,
    procMale: 0, procFemale: 0, refillMale: 0, refillFemale: 0, referDocMale: 0, referDocFemale: 0,
    admitMale: 0, admitFemale: 0, referOutMale: 0, referOutFemale: 0, topDiseases: [], topProcedures: [], reporterNote: '',
  };
}

suite('report service database invariants', () => {
  beforeAll(async () => {
    await prisma.user.create({ data: { id: actor.id, email: actor.email, name: actor.name, role: 'admin', active: true } });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: actor.id } });
    await prisma.draft.deleteMany({ where: { userId: actor.id } });
    await prisma.dailyReport.deleteMany({ where: { createdById: actor.id } });
    await prisma.user.delete({ where: { id: actor.id } });
    await prisma.$disconnect();
  });

  it('uses atomic CAS for first create and later update', async () => {
    const first = report(dates[0], 3);
    const created = await Promise.allSettled([saveReport(first, 0, actor), saveReport(first, 0, actor)]);
    expect(created.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(created.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const current = await findReport(dates[0]);
    expect(current?.version).toBe(1);

    const updated = report(dates[0], 8);
    const updates = await Promise.allSettled([saveReport(updated, 1, actor), saveReport(updated, 1, actor)]);
    expect(updates.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await findReport(dates[0]))?.totalMale).toBe(8);
  });

  it('stores a draft against a nonzero published base version', async () => {
    const draft = await saveDraft(dates[0], report(dates[0], 12), 2, actor);
    expect(draft.expectedVersion).toBe(2);
    expect(draft.data.totalMale).toBe(12);
  });

  it('rolls back an import when one overwrite CAS fails', async () => {
    await expect(importReports({ reports: [report(dates[0], 20), report(dates[1], 4)], mode: 'overwrite', expectedVersions: { [dates[0]]: 999, [dates[1]]: 0 } }, actor)).rejects.toBeDefined();
    expect(await findReport(dates[1])).toBeNull();
  });
});
