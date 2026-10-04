import { requireAdmin, AuthError } from '@/src/lib/authorization';
import { createInvitation, InvitationError, revokeInvitation, serializeInvitation } from '@/src/lib/invitations';
import { prisma } from '@/src/lib/db';

function errorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof InvitationError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: { code: 'internal_error', message: 'An unexpected error occurred.' } }, { status: 500 });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const existing = await prisma.invitation.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: { code: 'not_found', message: 'Invitation not found.' } }, { status: 404 });
    const result = await createInvitation({ email: existing.email, role: existing.role, createdById: actor.id });
    return Response.json({ invitation: serializeInvitation(result.invitation), delivery: result.delivery });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await revokeInvitation(id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
