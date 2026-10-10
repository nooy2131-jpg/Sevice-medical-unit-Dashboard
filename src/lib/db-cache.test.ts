import { expect, it } from 'bun:test';

it('retires a cached client generated before the mapping model existed', () => {
  const result = Bun.spawnSync([process.execPath, '-e', `
    let retired = false;
    const oldClient = { $disconnect: async () => { retired = true; } };
    Object.assign(globalThis, {
      prisma: oldClient,
      pool: { end: async () => {} },
      databaseUrl: process.env.DATABASE_URL,
    });
    const { prisma, disconnectDb } = await import('./src/lib/db.ts');
    const replaced = prisma !== oldClient && typeof prisma.reportMapping?.findMany === 'function';
    await disconnectDb();
    console.log(JSON.stringify({ replaced, retired }));
  `], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(new TextDecoder().decode(result.stdout).trim())).toEqual({ replaced: true, retired: true });
});
