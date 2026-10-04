import { NextResponse } from 'next/server';
import { requireUser } from '@/src/lib/authorization';
import { asHttpError, assertSameOrigin, jsonError, readJson, HttpError } from '@/src/lib/http';
import { deleteDraft, getDraft, saveDraft } from '@/src/lib/report-service';

type Context = { params: Promise<{ date: string }> };

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  try {
    const actor = await requireUser();
    const { date } = await context.params;
    return NextResponse.json({ draft: await getDraft(date, actor) });
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
    const data = input.data ?? input.report;
    const expectedDraftRevision = input.expectedDraftRevision ?? input.expectedRevision;
    const draft = await saveDraft(date, data, input.expectedVersion, expectedDraftRevision, actor);
    return NextResponse.json({ draft });
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const actor = await requireUser();
    const body = await readJson(request, true);
    const input = typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const { date } = await context.params;
    const expectedRevision = input.expectedDraftRevision ?? input.expectedRevision ?? new URL(request.url).searchParams.get('expectedDraftRevision');
    await deleteDraft(date, typeof expectedRevision === 'string' ? Number(expectedRevision) : expectedRevision, actor);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}
