import { NextResponse } from 'next/server';
import { requireAdmin } from '@/src/lib/authorization';
import { asHttpError, assertSameOrigin, jsonError, readJson, HttpError } from '@/src/lib/http';
import { importReports, type ImportMode } from '@/src/lib/report-service';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const body = await readJson(request);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'INVALID_BODY', 'Request body must be an object.');
    const input = body as Record<string, unknown>;
    if (!Array.isArray(input.reports)) throw new HttpError(400, 'INVALID_BODY', 'Request body must include reports.');
    const expectedVersions = typeof input.expectedVersions === 'object' && input.expectedVersions !== null && !Array.isArray(input.expectedVersions)
      ? Object.fromEntries(Object.entries(input.expectedVersions).map(([date, version]) => [date, version as number]))
      : {};
    const result = await importReports({ reports: input.reports, mode: input.mode as ImportMode, expectedVersions }, actor);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}
