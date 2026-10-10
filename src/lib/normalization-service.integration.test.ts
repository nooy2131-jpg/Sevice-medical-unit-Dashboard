import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { prisma } from './db';
import { deleteMapping, listMappingCandidates, listMappings, upsertMapping } from './normalization-service';

const canRun = process.env.OKR_RUN_DB_TESTS === '1' && /(?:localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL ?? '');
const suite = canRun ? describe : describe.skip;
const suffix = crypto.randomUUID();
const admin = { id: `mapping-admin-${suffix}`, email: `mapping-admin-${suffix}@example.invalid`, name: 'Mapping Admin', role: 'admin' as const };
const member = { id: `mapping-member-${suffix}`, email: `mapping-member-${suffix}@example.invalid`, name: 'Mapping Member', role: 'member' as const };
const reportDate = '2098-12-31';
const rawAlias = ` Common cld ${suffix} `;
const concurrentAlias = `Concurrent ${suffix}`;

suite('normalization service database invariants', () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: admin.id, email: admin.email, name: admin.name, role: 'admin', active: true },
      { id: member.id, email: member.email, name: member.name, role: 'member', active: true },
    ] });
    await prisma.dailyReport.create({
      data: {
        reportDate,
        data: {
          reportDate,
          topDiseases: [
            { name: 'Common cld', count: 2 },
            { name: 'DM', count: 4 },
          ],
          topProcedures: [{ name: 'Dressing', count: 3 }],
        },
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.reportMapping.deleteMany({ where: { rawName: { in: [rawAlias, concurrentAlias] } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [admin.id, member.id] } } });
    await prisma.dailyReport.deleteMany({ where: { reportDate } });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, member.id] } } });
    await prisma.$disconnect();
  });

  it('aggregates active raw names and leaves ambiguous aliases without suggestions', async () => {
    const candidates = await listMappingCandidates();
    expect(candidates).toContainEqual({
      kind: 'disease', rawName: 'Common cld', count: 2, dates: [reportDate],
      suggestion: { normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ' },
    });
    expect(candidates).toContainEqual({ kind: 'disease', rawName: 'DM', count: 4, dates: [reportDate], suggestion: null });
    expect(candidates).toContainEqual({
      kind: 'procedure', rawName: 'Dressing', count: 3, dates: [reportDate],
      suggestion: { normalizedName: 'ทำแผล', groupName: 'การดูแลบาดแผล' },
    });
  });

  it('enforces admin authorization, version CAS, tombstone recreation, and audit history', async () => {
    const before = await prisma.dailyReport.findUniqueOrThrow({ where: { reportDate }, select: { data: true } });
    await expect(upsertMapping({ kind: 'disease', rawName: rawAlias, normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ', expectedVersion: 0 }, member)).rejects.toMatchObject({ status: 403 });

    const created = await upsertMapping({ kind: 'disease', rawName: rawAlias, normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ', expectedVersion: 0 }, admin);
    expect(created.version).toBe(1);
    expect(created.rawName).toBe(rawAlias);

    const updated = await upsertMapping({ kind: 'disease', rawName: rawAlias, normalizedName: 'ไข้หวัด', groupName: 'โรคติดเชื้อ', expectedVersion: 1 }, admin);
    expect(updated.version).toBe(2);
    await expect(upsertMapping({ kind: 'disease', rawName: rawAlias, normalizedName: 'stale', groupName: 'stale', expectedVersion: 1 }, admin)).rejects.toMatchObject({ status: 409 });

    await deleteMapping({ id: updated.id, expectedVersion: 2 }, admin);
    const recreated = await upsertMapping({ kind: 'disease', rawName: rawAlias, normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ', expectedVersion: 0 }, admin);
    expect(recreated.id).toBe(updated.id);
    expect(recreated.version).toBe(4);
    await expect(upsertMapping({ kind: 'disease', rawName: rawAlias, normalizedName: 'stale', groupName: 'stale', expectedVersion: 2 }, admin)).rejects.toMatchObject({ status: 409 });

    const concurrentCreates = await Promise.allSettled([
      upsertMapping({ kind: 'procedure', rawName: concurrentAlias, normalizedName: 'ทำแผล', groupName: 'การดูแลบาดแผล', expectedVersion: 0 }, admin),
      upsertMapping({ kind: 'procedure', rawName: concurrentAlias, normalizedName: 'ทำแผล', groupName: 'การดูแลบาดแผล', expectedVersion: 0 }, admin),
    ]);
    expect(concurrentCreates.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrentCreates.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const concurrentCreated = await prisma.reportMapping.findUniqueOrThrow({ where: { kind_rawName: { kind: 'procedure', rawName: concurrentAlias } } });
    const concurrentUpdates = await Promise.allSettled([
      upsertMapping({ kind: 'procedure', rawName: concurrentAlias, normalizedName: 'ทำแผล', groupName: 'A', expectedVersion: concurrentCreated.version }, admin),
      upsertMapping({ kind: 'procedure', rawName: concurrentAlias, normalizedName: 'ทำแผล', groupName: 'B', expectedVersion: concurrentCreated.version }, admin),
    ]);
    expect(concurrentUpdates.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrentUpdates.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const memberView = await listMappings(member);
    expect(memberView.candidates).toBeUndefined();
    await prisma.user.update({ where: { id: admin.id }, data: { active: false } });
    await expect(upsertMapping({ kind: 'disease', rawName: rawAlias, normalizedName: 'blocked', groupName: 'blocked', expectedVersion: recreated.version }, admin)).rejects.toMatchObject({ status: 403 });
    await prisma.user.update({ where: { id: admin.id }, data: { active: true } });

    const visible = await listMappings(admin);
    expect(visible.mappings).toContainEqual(expect.objectContaining(recreated));
    expect(visible.candidates).toEqual(expect.arrayContaining([{ kind: 'disease', rawName: 'Common cld', count: 2, dates: [reportDate], suggestion: { normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ' } }]));
    const after = await prisma.dailyReport.findUniqueOrThrow({ where: { reportDate }, select: { data: true } });
    expect(after.data).toEqual(before.data);

    const audit = await prisma.auditLog.findMany({ where: { actorId: admin.id, entityId: recreated.id }, orderBy: { createdAt: 'asc' }, select: { action: true } });
    expect(audit.map((entry) => entry.action)).toEqual(['mapping.created', 'mapping.updated', 'mapping.deleted', 'mapping.restored']);
  });
});
