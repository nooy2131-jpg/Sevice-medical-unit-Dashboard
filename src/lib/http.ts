import { NextResponse } from 'next/server';
import { ReportValidationError } from './report-validation';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) } }, { status: error.status });
  }
  if (error instanceof ReportValidationError) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'The report data is invalid.', details: error.issues } }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request.' } }, { status: 500 });
}

export async function readJson(request: Request, allowEmpty = false): Promise<unknown> {
  try {
    const text = await request.text();
    if (!text.trim() && allowEmpty) return {};
    if (!text.trim()) throw new Error('empty body');
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

/** Session cookies alone do not make cross-site state-changing requests safe. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const requestUrl = new URL(request.url);
  const configured = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : null;
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '');
  const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin;
  if (origin !== requestUrl.origin && origin !== forwardedOrigin && origin !== configured) {
    throw new HttpError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed.');
  }
}

export function asHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof ReportValidationError) return new HttpError(400, 'VALIDATION_ERROR', 'The report data is invalid.', error.issues);
  const source = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const status = typeof source.status === 'number' ? source.status : typeof source.statusCode === 'number' ? source.statusCode : 500;
  if (status === 400) return new HttpError(400, 'BAD_REQUEST', 'The request is invalid.');
  if (status === 401) return new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  if (status === 403) return new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  if (status === 404) return new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.');
  if (status === 409) return new HttpError(409, 'CONFLICT', 'The resource changed.');
  if (status === 410) return new HttpError(410, 'GONE', 'The requested resource is no longer available.');
  if (status === 429) return new HttpError(429, 'RATE_LIMITED', 'Too many requests.');
  return new HttpError(500, 'INTERNAL_ERROR', 'Unable to complete the request.');
}
