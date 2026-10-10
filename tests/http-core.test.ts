import { describe, expect, it } from 'bun:test';
import { assertSameOrigin, HttpError, readJson } from '@/src/lib/http';
import { POST as createInvitation } from '@/app/api/invitations/route';
import { POST as resendInvitation, DELETE as revokeInvitation } from '@/app/api/invitations/[id]/route';
import { POST as acceptInvitation } from '@/app/api/invitations/accept/route';
import { PATCH as updateUser } from '@/app/api/users/[id]/route';
import { POST as approveMapping, DELETE as removeMapping } from '@/app/api/mappings/route';

describe('HTTP request guards', () => {
  it('rejects a cross-site state-changing request before authorization', () => {
    let error: unknown;
    try {
      assertSameOrigin(new Request('http://localhost:40000/api/users', { headers: { origin: 'https://evil.example' } }));
    } catch (reason) {
      error = reason;
    }
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe('ORIGIN_FORBIDDEN');
  });

  it('turns malformed JSON into a 400 HttpError', async () => {
    let error: unknown;
    try {
      await readJson(new Request('http://localhost:40000/api/invitations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }));
    } catch (reason) {
      error = reason;
    }
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).code).toBe('INVALID_JSON');
  });

  it('bounds chunked bodies before JSON parsing', async () => {
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1;
        controller.enqueue(new Uint8Array(512));
        if (reads === 4) controller.close();
      },
    });
    let error: unknown;
    try {
      await readJson(new Request('http://localhost:40000/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }), false, 1_000);
    } catch (reason) {
      error = reason;
    }
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(413);
    expect(reads).toBe(2);
  });

  it('limits public invitation acceptance to 4 KiB', async () => {
    const response = await acceptInvitation(new Request('http://localhost:40000/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:40000' },
      body: JSON.stringify({ token: 'a'.repeat(32), password: 'password', name: 'x'.repeat(5_000) }),
    }));
    expect(response.status).toBe(413);
  });

  it('rejects cross-site state changes at auth, invitation, and mapping routes', async () => {
    const request = (url: string, method: string, body?: string) => new Request(`http://localhost:40000${url}`, {
      method,
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body }),
    });
    const cases = [
      createInvitation(request('/api/invitations', 'POST', '{}')),
      resendInvitation(request('/api/invitations/id', 'POST'), { params: Promise.resolve({ id: 'id' }) }),
      revokeInvitation(request('/api/invitations/id', 'DELETE'), { params: Promise.resolve({ id: 'id' }) }),
      acceptInvitation(request('/api/invitations/accept', 'POST', '{}')),
      updateUser(request('/api/users/id', 'PATCH', '{}'), { params: Promise.resolve({ id: 'id' }) }),
      approveMapping(request('/api/mappings', 'POST', '{}')),
      removeMapping(request('/api/mappings', 'DELETE', '{}')),
    ];
    const responses = await Promise.all(cases);
    expect(responses.every((response) => response.status === 403)).toBe(true);
  });
});
