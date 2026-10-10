import { NextResponse } from 'next/server';
import { requireAdmin, requireUser } from '@/src/lib/authorization';
import { asHttpError, assertSameOrigin, jsonError, readJson } from '@/src/lib/http';
import { deleteMapping, listMappings, upsertMapping } from '@/src/lib/normalization-service';

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await requireUser();
    return NextResponse.json(await listMappings(actor));
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const body = await readJson(request, false, 64_000);
    const mapping = await upsertMapping(body, actor);
    return NextResponse.json({ mapping });
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const body = await readJson(request, false, 64_000);
    const deleted = await deleteMapping(body, actor);
    return NextResponse.json({ deleted: true, id: deleted.id });
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}
