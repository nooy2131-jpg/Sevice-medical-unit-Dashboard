import { requireAdmin, AuthError } from '@/src/lib/authorization';
import { prisma } from '@/src/lib/db';

function errorResponse(error: unknown) {
  if (error instanceof AuthError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error(error);
  return Response.json({ error: { code: 'internal_error', message: 'An unexpected error occurred.' } }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return Response.json({ users: users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() })) });
  } catch (error) {
    return errorResponse(error);
  }
}
