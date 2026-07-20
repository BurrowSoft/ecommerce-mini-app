# node:22-slim (Debian, glibc) rather than alpine: Prisma's query engine
# binaries target glibc by default, and matching that avoids musl-target
# binary mismatches under time pressure — see backend commit history for
# the same reasoning applied to the Prisma generator choice.
FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
# Needed BEFORE `prisma generate`, not just at runtime: without it, Prisma
# can't detect the real OpenSSL version and silently guesses a fallback
# ("openssl-1.1.x"), generating a query engine binary that doesn't match
# what's actually installed in the runtime stage ("openssl-3.0.x") —
# resulting in a "could not locate the Query Engine" error at container
# start, not at build time, so it only surfaces when actually running the
# full stack rather than in any individual build step looking wrong.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts eagerly validates DATABASE_URL exists at load time (via
# env()), even for `generate`, which never actually connects to a database —
# it only reads schema.prisma. The real DATABASE_URL is injected at
# container *run* time by docker-compose; this placeholder just satisfies
# that load-time check during the build.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
# NODE_ENV is intentionally NOT hardcoded here — docker-compose injects the
# real value at container run time (see .env.example for why it's
# "development" even in this "production-built" image: the session cookie's
# `secure` flag depends on it, and this stack runs over plain http).
# openssl is a runtime requirement for Prisma's query engine on Debian-based images.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Reuse the build stage's node_modules directly rather than a fresh `npm ci`
# here: a second install re-triggers @prisma/client's postinstall
# `prisma generate` without DATABASE_URL set (same problem as above, one
# level removed), which silently leaves the client uninitialized instead of
# failing loudly — caught by actually running `docker compose up` end to
# end, not by any of the build steps looking wrong in isolation. This also
# naturally includes tsx (a devDependency), needed by the seed script and by
# prisma.config.ts at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY package*.json ./

EXPOSE 4000
# Migrate (never prompts, safe for CI/containers) then seed then boot.
# Seed re-runs on every start — see prisma/seed.ts for why that's safe
# (idempotent: upserts demo users, truncates+regenerates the fake catalog).
# Entrypoint is dist/src/main.js, not dist/main.js: tsc's rootDir spans both
# src/ and prisma/ (prisma.config.ts and prisma/seed.ts live outside src/
# but still get compiled), so it preserves the src/ subdirectory in dist/.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/main"]
