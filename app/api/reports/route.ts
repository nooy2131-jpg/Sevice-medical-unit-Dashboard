import { NextResponse } from 'next/server';
import { requireUser } from '@/src/lib/authorization';
import { asHttpError, jsonError } from '@/src/lib/http';
import { listReports } from '@/src/lib/report-service';

export async function GET(): Promise<NextResponse> {
  try {
    await requireUser();
    return NextResponse.json({ reports: await listReports() });
  } catch (error) {
    return jsonError(asHttpError(error));
  }
}
