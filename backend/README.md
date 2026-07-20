# Backend

NestJS + Prisma + PostgreSQL API for the e-commerce mini-app. See the
[repo-root README](../README.md) for setup, architecture, and everything else —
this file intentionally doesn't duplicate it.

Local dev: `npm install && npx prisma migrate deploy && npx prisma db seed && npm run start:dev`
(expects Postgres reachable at `DATABASE_URL`, see `../.env.example`).
