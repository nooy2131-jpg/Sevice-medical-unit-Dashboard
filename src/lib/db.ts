import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/src/generated/prisma/client';
import { Pool } from 'pg';

type PrismaGlobalCache = {
  prisma?: PrismaClient;
  pool?: Pool;
  databaseUrl?: string;
};

const globalForPrisma = globalThis as unknown as PrismaGlobalCache;
const databaseUrl = process.env.DATABASE_URL;
const cachedPrisma = globalForPrisma.prisma;
const cachedPool = globalForPrisma.pool;
const canReuseCache = process.env.NODE_ENV !== 'production' &&
  cachedPrisma !== undefined &&
  // Hot reload can retain a client generated before the latest schema change.
  cachedPrisma.reportMapping !== undefined &&
  cachedPool !== undefined &&
  globalForPrisma.databaseUrl === databaseUrl;

function retireCache(prismaClient: PrismaClient, cachedPool: Pool): void {
  void prismaClient.$disconnect()
    .catch(() => undefined)
    .finally(() => {
      void cachedPool.end().catch(() => undefined);
    });
}

if (!canReuseCache && process.env.NODE_ENV !== 'production' && cachedPrisma && cachedPool) {
  retireCache(cachedPrisma, cachedPool);
}

const pool: Pool = canReuseCache
  ? cachedPool!
  : new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
export const prisma: PrismaClient = canReuseCache
  ? cachedPrisma!
  : new PrismaClient({ adapter });

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
  globalForPrisma.databaseUrl = databaseUrl;
}
