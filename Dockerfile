FROM oven/bun:1.4.2 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
# Next.js inlines NEXT_PUBLIC_* values during the build, so this must match the
# public deployment origin instead of relying on a runtime environment value.
ARG NEXT_PUBLIC_APP_URL=https://okr-unit.pskwr.com
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build bun run db:generate
# Give the build a one-use secret without persisting it as image configuration.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n')" \
    bun run build

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
