import { NextResponse } from 'next/server';
import { requireAdmin } from '@/src/lib/authorization';
import { asHttpError, assertSameOrigin, jsonError, readJson, HttpError } from '@/src/lib/http';
import { importReports, type ImportMode } from '@/src/lib/report-service';
import { parseImportText } from '@/src/lib/csv';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const body = await readJson(request);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'INVALID_BODY', 'Request body must be an object.');
    const input = body as Record<string, unknown>;
    const reports = Array.isArray(input.reports) ? input.reports : typeof input.csv === 'string' ? parseImportText(input.csv) : null;
    if (!reports) throw new HttpError(400, 'INVALID_BODY', 'Request body must include reports or csv.');
    const mode = input.mode ?? input.duplicateMode;
    const expectedVersions = typeof input.expectedVersions === 'object' && input.expectedVersions !== null && !Array.isArray(input.expectedVersions)
      ? Object.fromEntries(Object.entries(input.expectedVersions).map(([date, version]) => [date, version as number]))
      : {};
    const result = await importReports({ reports, mode: mode as ImportMode, expectedVersions }, actor);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}
