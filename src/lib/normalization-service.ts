import type { Prisma, PrismaClient } from '@/src/generated/prisma/client';
import { Role } from '@/src/generated/prisma/client';
import type { MappingCandidate, MappingKind, MappingResponse, ReportMapping } from '@/src/types/normalization';
import { prisma } from './db';
import { HttpError } from './http';
import { suggestMapping } from './normalization-suggestions';

const MAX_MAPPING_NAME_LENGTH = 240;
const MAX_MAPPING_CANDIDATES = 10_000;
const database: PrismaClient = prisma;

type MappingActor = { id: string; role: string };
type MappingUpsertInput = {
  kind: MappingKind;
  rawName: string;
  normalizedName: string;
  groupName: string;
  expectedVersion: number;
};
type MappingDeleteInput = { id: string; expectedVersion: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseName(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim().length === 0 || value.length > MAX_MAPPING_NAME_LENGTH) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${path} must be 1-${MAX_MAPPING_NAME_LENGTH} characters.`);
  }
  // Preserve the submitted value exactly. In particular, rawName is an alias,
  // so leading/trailing characters are significant and must not be normalized.
  return value;
}

function parseVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'expectedVersion must be a non-negative integer.');
  }
  return value;
}

function parseKind(value: unknown): MappingKind {
  if (value !== 'disease' && value !== 'procedure') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'kind must be disease or procedure.');
  }
  return value;
}

export function validateMappingUpsert(value: unknown): MappingUpsertInput {
  if (!isRecord(value)) throw new HttpError(400, 'INVALID_BODY', 'Request body must be an object.');
  return {
    kind: parseKind(value.kind),
    rawName: parseName(value.rawName, 'rawName'),
    normalizedName: parseName(value.normalizedName, 'normalizedName'),
    groupName: parseName(value.groupName, 'groupName'),
    expectedVersion: parseVersion(value.expectedVersion),
  };
}

export function validateMappingDelete(value: unknown): MappingDeleteInput {
  if (!isRecord(value)) throw new HttpError(400, 'INVALID_BODY', 'Request body must be an object.');
  if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 100) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'id must be 1-100 characters.');
  }
  return { id: value.id, expectedVersion: parseVersion(value.expectedVersion) };
}

function mapMapping(value: {
  id: string;
  kind: MappingKind;
  rawName: string;
  normalizedName: string;
  groupName: string;
  version: number;
}): ReportMapping {
  return {
    id: value.id,
    kind: value.kind,
    rawName: value.rawName,
    normalizedName: value.normalizedName,
    groupName: value.groupName,
    version: value.version,
  };
}

function conflict(message = 'The mapping changed since it was loaded.'): HttpError {
  return new HttpError(409, 'VERSION_CONFLICT', message);
}

async function assertActiveAdmin(tx: Prisma.TransactionClient, actor: MappingActor): Promise<void> {
  const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, active: true } });
  if (!currentActor || !currentActor.active || currentActor.role !== Role.admin) {
    throw new HttpError(403, 'FORBIDDEN', 'Admin access is required.');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function listMappings(actor: MappingActor): Promise<MappingResponse> {
  const mappings = await database.reportMapping.findMany({
    where: { deletedAt: null },
    orderBy: [{ kind: 'asc' }, { rawName: 'asc' }],
  });
  const response: MappingResponse = { mappings: mappings.map(mapMapping) };
  if (actor.role === 'admin') response.candidates = await listMappingCandidates();
  return response;
}

type CandidateAccumulator = { count: number; dates: Set<string> };

function asCount(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  return fallback;
}

function addCount(current: number, increment: number): number {
  const result = current + increment;
  return Number.isSafeInteger(result) ? result : Number.MAX_SAFE_INTEGER;
}

function collectCandidates(data: unknown, reportDate: string, kind: MappingKind, result: Map<string, CandidateAccumulator>): void {
  if (!isRecord(data)) return;
  const field = kind === 'disease' ? 'topDiseases' : 'topProcedures';
  const items = data[field];
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!isRecord(item) || typeof item.name !== 'string' || item.name.length === 0) continue;
    const male = asCount(item.male, 0);
    const female = asCount(item.female, 0);
    const count = asCount(item.count, male + female);
    const existing = result.get(item.name);
    if (existing) {
      existing.count = addCount(existing.count, count);
      existing.dates.add(reportDate);
    } else {
      result.set(item.name, { count, dates: new Set([reportDate]) });
    }
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export async function listMappingCandidates(): Promise<MappingCandidate[]> {
  const reports = await database.dailyReport.findMany({ where: { deletedAt: null }, select: { reportDate: true, data: true } });
  const byKind: ReadonlyArray<MappingKind> = ['disease', 'procedure'];
  const candidates: MappingCandidate[] = [];
  for (const kind of byKind) {
    const aliases = new Map<string, CandidateAccumulator>();
    for (const report of reports) collectCandidates(report.data, report.reportDate, kind, aliases);
    const names = [...aliases.keys()].sort(compareStrings).slice(0, MAX_MAPPING_CANDIDATES);
    for (const rawName of names) {
      const aggregate = aliases.get(rawName);
      if (!aggregate) continue;
      candidates.push({
        kind,
        rawName,
        count: aggregate.count,
        dates: [...aggregate.dates].sort(compareStrings),
        suggestion: suggestMapping(kind, rawName),
      });
    }
  }
  return candidates;
}

export async function upsertMapping(rawValue: unknown, actor: MappingActor): Promise<ReportMapping> {
  const input = validateMappingUpsert(rawValue);
  try {
    return await database.$transaction(async (tx) => {
      await assertActiveAdmin(tx, actor);
      const current = await tx.reportMapping.findUnique({ where: { kind_rawName: { kind: input.kind, rawName: input.rawName } } });
      let saved;
      let action: string;
      if (current === null) {
        if (input.expectedVersion !== 0) throw conflict('No current mapping exists.');
        saved = await tx.reportMapping.create({
          data: { kind: input.kind, rawName: input.rawName, normalizedName: input.normalizedName, groupName: input.groupName },
        });
        action = 'mapping.created';
      } else if (current.deletedAt !== null) {
        if (input.expectedVersion !== 0) throw conflict('The mapping was deleted.');
        const restored = await tx.reportMapping.updateMany({
          where: { id: current.id, version: current.version, deletedAt: { not: null } },
          data: { normalizedName: input.normalizedName, groupName: input.groupName, version: { increment: 1 }, deletedAt: null },
        });
        if (restored.count !== 1) throw conflict('The mapping changed while it was being restored.');
        saved = await tx.reportMapping.findUnique({ where: { id: current.id } });
        action = 'mapping.restored';
      } else {
        if (input.expectedVersion === 0) throw conflict('A mapping for this raw name already exists.');
        const updated = await tx.reportMapping.updateMany({
          where: { id: current.id, version: input.expectedVersion, deletedAt: null },
          data: { normalizedName: input.normalizedName, groupName: input.groupName, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw conflict();
        saved = await tx.reportMapping.findUnique({ where: { id: current.id } });
        action = 'mapping.updated';
      }
      if (saved === null || saved === undefined || saved.deletedAt !== null) throw new Error('Mapping disappeared during transaction.');
      const mapping = mapMapping(saved);
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action,
          entityId: mapping.id,
          data: {
            kind: mapping.kind,
            rawName: mapping.rawName,
            normalizedName: mapping.normalizedName,
            groupName: mapping.groupName,
            version: mapping.version,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return mapping;
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) throw conflict('A mapping for this raw name changed while it was being created.');
    throw error;
  }
}

export async function deleteMapping(rawValue: unknown, actor: MappingActor): Promise<{ id: string }> {
  const input = validateMappingDelete(rawValue);
  return database.$transaction(async (tx) => {
    await assertActiveAdmin(tx, actor);
    const current = await tx.reportMapping.findUnique({ where: { id: input.id } });
    if (current === null || current.deletedAt !== null) throw conflict('The mapping was deleted since it was loaded.');
    const deletedAt = new Date();
    const deleted = await tx.reportMapping.updateMany({
      where: { id: input.id, version: input.expectedVersion, deletedAt: null },
      data: { deletedAt, version: { increment: 1 } },
    });
    if (deleted.count !== 1) throw conflict();
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'mapping.deleted',
        entityId: input.id,
        data: { kind: current.kind, rawName: current.rawName, version: input.expectedVersion, deletedAt: deletedAt.toISOString() },
      },
    });
    return { id: input.id };
  });
}
