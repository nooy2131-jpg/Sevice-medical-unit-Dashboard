import { prisma } from '@/src/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    console.error(error);
    return Response.json({ status: 'degraded', database: 'error' }, { status: 503 });
  }
}
