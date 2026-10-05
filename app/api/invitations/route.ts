import { z } from 'zod';
import { requireAdmin, AuthError } from '@/src/lib/authorization';
import { createInvitation, InvitationError, serializeInvitation } from '@/src/lib/invitations';
import { prisma } from '@/src/lib/db';
import { assertSameOrigin, HttpError, readJson } from '@/src/lib/http';

const createSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(['admin', 'member']).default('member'),
});

function errorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof InvitationError || error instanceof HttpError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: { code: 'internal_error', message: 'An unexpected error occurred.' } }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();
    const invitations = await prisma.invitation.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return Response.json({ invitations: invitations.map(serializeInvitation) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const input = createSchema.parse(await readJson(request));
    const result = await createInvitation({ ...input, createdById: actor.id });
    return Response.json({ invitation: serializeInvitation(result.invitation), delivery: result.delivery }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: { code: 'invalid_request', message: 'Email and role are required.', issues: error.issues } }, { status: 400 });
    }
    return errorResponse(error);
  }
}
