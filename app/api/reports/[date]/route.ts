import { NextResponse } from 'next/server';
import { requireAdmin, requireUser } from '@/src/lib/authorization';
import { asHttpError, assertSameOrigin, jsonError, readJson, HttpError } from '@/src/lib/http';
import { deleteReport, findReport, saveReport } from '@/src/lib/report-service';

type Context = { params: Promise<{ date: string }> };

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  try {
    await requireUser();
    const { date } = await context.params;
    const report = await findReport(date);
    if (report === null) throw new HttpError(404, 'REPORT_NOT_FOUND', 'No report exists for this date.');
    return NextResponse.json({ report });
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}

export async function PUT(request: Request, context: Context): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const actor = await requireUser();
    const body = await readJson(request);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'INVALID_BODY', 'Request body must be an object.');
    const input = body as Record<string, unknown>;
    const { date } = await context.params;
    const report = input.report;
    if (typeof report !== 'object' || report === null) throw new HttpError(400, 'INVALID_BODY', 'Request body must include report.');
    const reportObject = report as Record<string, unknown>;
    if (reportObject.reportDate !== undefined && reportObject.reportDate !== date) throw new HttpError(400, 'DATE_MISMATCH', 'Report reportDate must match the URL date.');
    const reportWithDate = { ...reportObject, reportDate: date };
    const saved = await saveReport(reportWithDate, input.expectedVersion, actor);
    return NextResponse.json({ report: saved });
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const body = await readJson(request);
    const input = typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const { date } = await context.params;
    await deleteReport(date, input.expectedVersion, actor);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}
