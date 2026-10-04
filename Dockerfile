FROM oven/bun:1.4.2 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
# Build-time placeholder only; the runtime secret is injected by the deployment.
ENV BETTER_AUTH_SECRET=build-only-secret-012345678901234567890123
RUN bun run db:generate
RUN bun run build

# This target deliberately retains the Prisma CLI, schema, and migration files.
# Run it as a reviewed migration Job; the normal app image never runs migrations.
FROM deps AS migrate
WORKDIR /app
COPY . .
ENTRYPOINT ["bun", "run", "db:deploy"]

FROM oven/bun:1.4.2 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=40000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER bun
EXPOSE 40000
CMD ["bun", "server.js"]
