import { z } from 'zod';
import { AuthError, requireAdmin, updateUserMembership } from '@/src/lib/authorization';
import { assertSameOrigin, HttpError, readJson } from '@/src/lib/http';

const patchSchema = z.object({
  role: z.enum(['admin', 'member']).optional(),
  active: z.boolean().optional(),
}).refine((value) => value.role !== undefined || value.active !== undefined, { message: 'role or active is required' });

function errorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof HttpError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error(error);
  return Response.json({ error: { code: 'internal_error', message: 'An unexpected error occurred.' } }, { status: 500 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin();
    const input = patchSchema.parse(await readJson(request));
    const { id } = await context.params;
    const user = await updateUserMembership(actor, id, input);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: { code: 'invalid_request', message: 'Only role and active may be changed.', issues: error.issues } }, { status: 400 });
    return errorResponse(error);
  }
}
