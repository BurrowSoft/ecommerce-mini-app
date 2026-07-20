# E-commerce Mini-App — Senior Engineer Take-Home

> **Status: scaffolding stage.** This README is being built up commit-by-commit alongside
> the app (see project history). Sections marked `TODO` are filled in as the corresponding
> feature lands — nothing below is a claim about finished functionality yet.

## Overview

A production-minded e-commerce product catalog: authenticated product browsing with
search, category filtering, infinite-scroll pagination, and sponsored-item slotting,
built as a Next.js (App Router) frontend + NestJS backend + PostgreSQL, fully
containerized via Docker Compose.

## Tech stack

| Layer      | Choice                                   | Why                                                                 |
|------------|-------------------------------------------|----------------------------------------------------------------------|
| Frontend   | Next.js (App Router), TypeScript          | Required by spec                                                     |
| Backend    | NestJS, TypeScript                        | Required by spec                                                     |
| Database   | PostgreSQL                                | Required by spec                                                     |
| ORM        | `TODO` (Prisma, tentative)                | Migration + seed DX                                                   |
| Sessions   | `express-session` + Postgres-backed store | Server-side invalidation is a hard requirement — see Trade-offs      |
| Containers | Docker / Docker Compose                   | Required by spec — single `docker compose up` boots everything      |

## Getting started

```bash
cp .env.example .env   # TODO: fill in once .env.example exists
docker compose up
```

`TODO`: confirm final port mapping, first-boot migration + seed behavior, and add this
section's actual steps once Phase 5 of the build lands.

## Demo credentials

`TODO` — populated once the seed script (Phase 1) exists. Will list at least one working
username/email + password pair here, verbatim, so the app is immediately usable.

## Architecture

`TODO` — Mermaid diagram covering client, API, database, auth flow, and any external
services, committed alongside this README once the shape of the system is final
(Phase 5).

## Authentication & session design

`TODO` once Phase 2 lands. Will document explicitly, verbatim, here:
- How "inactivity" is defined for the 1-hour timeout (currently planned: session tracks
  `lastSeenAt`, refreshed on every authenticated request; expired sessions are destroyed
  server-side and return 401, forcing re-login).
- Rate limiting strategy (per-IP and per-account, on the login endpoint).
- Cookie flags and CSRF posture.

## Product catalog design

`TODO` once Phase 3 lands. Will document:
- Pagination approach (cursor/keyset vs offset) and why, with perf reasoning.
- Search approach and the trade-offs considered (see PLAN.md for the current leaning —
  not repeating internal planning detail here until it's actually implemented).
- Category filtering.
- Sponsored item slotting rules and the abuse-prevention discussion required by the spec.

## Testing strategy

`TODO` — filled in as tests are added per PLAN.md phases.

## Trade-offs & what I'd do differently with more time

`TODO` — this section is a first-class deliverable per the assignment brief and will be
kept honest and specific (not generic hedging) as scope decisions actually get made
during the build, including anything cut under time pressure.

## Improvements / enhancements beyond spec

`TODO` — anything implemented from the brainstorm beyond the required feature set will be
listed here explicitly, per the assignment's request not to let extras go unnoticed.

## Credits

The search box's interaction pattern (debounce, arrow-key navigation, outside-click close,
empty-state fallback) is adapted from an existing BurrowSoft product's search UX. No code,
API keys, or external services are shared between that product and this app — this
project's search runs entirely against its own seeded Postgres data.

## Live deployment

Not provided. This was considered (mounting under an existing BurrowSoft production
domain), but deliberately skipped: the spec's actual deliverable is a public repo plus a
local `docker compose up`, and standing up a live route would have meant touching a real,
indexed, monetized production site for no graded benefit. Run it locally per the steps
above.

## Environment variables

See `.env.example` (added in Phase 5) for the full list with descriptions.
