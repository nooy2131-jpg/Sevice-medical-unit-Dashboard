import { z } from 'zod';
import { acceptInvitation, findUsableInvitationByToken, InvitationError } from '@/src/lib/invitations';

const acceptSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120),
});

function errorResponse(error: unknown) {
  if (error instanceof InvitationError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: { code: 'internal_error', message: 'An unexpected error occurred.' } }, { status: 500 });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const invitation = await findUsableInvitationByToken(token);
  if (!invitation) return Response.json({ error: { code: 'invalid_invitation', message: 'This invitation is invalid or expired.' } }, { status: 410 });
  return Response.json({ invitation: { email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt.toISOString() } });
}

export async function POST(request: Request) {
  try {
    const input = acceptSchema.parse(await request.json());
    const user = await acceptInvitation(input);
    return Response.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: { code: 'invalid_request', message: 'Name, password, and invitation token are required.', issues: error.issues } }, { status: 400 });
    }
    return errorResponse(error);
  }
}
