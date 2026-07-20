# E-commerce Mini-App — Senior Engineer Take-Home

A production-minded e-commerce product catalog: authenticated product browsing with
trigram search, category filtering, virtualized infinite scroll, and sponsored-item
slotting, built as Next.js (App Router) + NestJS + PostgreSQL, fully containerized via
Docker Compose.

## Tech stack

| Layer      | Choice                                       | Why                                                                                     |
|------------|-----------------------------------------------|------------------------------------------------------------------------------------------|
| Frontend   | Next.js 16 (App Router), TypeScript, Tailwind | Required by spec                                                                          |
| Backend    | NestJS 11, TypeScript                         | Required by spec                                                                          |
| Database   | PostgreSQL 16                                 | Required by spec                                                                          |
| ORM        | Prisma 6.19.3 (classic `prisma-client-js`)     | Fast migration + seed DX. Pinned below the newly-released v7 and off the newer `prisma-client` generator — see "Trade-offs" |
| Sessions   | `express-session` + Postgres-backed store     | Server-side invalidation is a hard requirement — see "Authentication & sessions"          |
| Containers | Docker / Docker Compose                       | Required by spec — a single `docker compose up` boots everything                         |

## Getting started

```bash
cp .env.example .env
docker compose up --build
```

That's it. On first boot the backend container runs `prisma migrate deploy` (applies the
schema) then `prisma db seed` (populates demo users + ~3,020 products) before starting the
API — so the app is fully usable immediately, no manual setup step. Then:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

The seed step re-runs on every container start. This is deliberate, not a bug: it's fully
idempotent (demo users are upserted, the product catalog is `TRUNCATE ... RESTART
IDENTITY`'d and regenerated from a fixed `faker.seed(42)`), so restarting the stack always
gets you back to a known-good state rather than accumulating drift.

### Running locally without Docker (backend/frontend dev servers)

Useful for faster iteration than a full image rebuild:

```bash
docker compose up postgres   # just the DB
cd backend && npm install && npx prisma migrate deploy && npx prisma db seed && npm run start:dev
cd frontend && npm install && npm run dev
```

## Demo credentials

| Email               | Password       |
|----------------------|----------------|
| `demo@example.com`   | `ChangeMe123!` |
| `demo2@example.com`  | `ChangeMe123!` |

Two accounts exist (not one) so the login error states are both demoable without either
response leaking which case applies: a wrong password and a nonexistent account return the
identical generic `"Invalid email or password"` message.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full Mermaid diagrams: system
overview, detailed auth sequence, and the Docker Compose deployment topology.

## Authentication & sessions

- **Inactivity, defined explicitly**: each session carries a `lastSeenAt` timestamp,
  refreshed on every request that passes the session guard. A request is rejected (401,
  and the session is destroyed server-side) once `now - lastSeenAt` exceeds
  `SESSION_INACTIVITY_TIMEOUT_SECONDS` (default 3600 = 1 hour). This is a **sliding**
  window from the most recent request, not a fixed expiry from login time — "inactivity"
  means no authenticated request received, matching the spec's own example.
- **Session storage**: `express-session` backed by `connect-pg-simple` (its own
  auto-created `session` table in the same Postgres instance), not an in-memory store —
  survives backend restarts.
- **Session fixation**: the session id is regenerated on successful login rather than
  reusing the pre-auth session.
- **Cookie flags**: `httpOnly` always; `sameSite=lax`; `secure` is tied to `NODE_ENV`,
  which is intentionally `development` even in the Docker image, because this whole stack
  runs over plain `http://localhost` — see `.env.example` for the full explanation.
- **Rate limiting on `POST /auth/login`**: both **per-IP** and **per-account**, tracked
  independently (an attacker rotating accounts from one IP still hits the IP limit; an
  attacker rotating IPs against one account still hits the account limit). Defaults: 10
  attempts/60s per IP, 5 attempts/60s per account (both configurable). Exceeding either
  returns `429` with a `Retry-After` header.
  - **Why self-authored instead of `@nestjs/throttler`**: getting genuinely independent
    IP-tracked and account-tracked limits out of that library means overriding
    `getTracker` per named throttler, and the exact multi-tracker API shape has changed
    across its major versions in ways I wasn't fully certain about from memory. This is a
    security-relevant, explicitly graded requirement, so I chose to own ~50 lines I could
    fully unit test over guessing at a library's internals under time pressure. It's
    in-memory (resets on restart, doesn't share state across instances) — the same
    trade-off as the session store, fine for a single-instance deployment.
- **Timing side-channel**: a login attempt against a nonexistent email still runs a dummy
  `bcrypt.compare` against a fixed hash, so it takes roughly as long as a wrong-password
  attempt against a real account — the response time itself doesn't leak account
  existence.
- **CSRF posture**: since auth is cookie-based (not a bearer token the frontend attaches
  manually), this app is CSRF-relevant, and `sameSite=lax` alone isn't a complete answer.
  Addressed via a double-submit cookie (see "Extras" below): a non-`httpOnly` `csrf_token`
  cookie set on login must be echoed back in an `X-CSRF-Token` header on every
  state-changing request, checked against the session-stored copy.

## Product catalog

- **Auth-gated**: every `/products` route sits behind the same session guard as the rest
  of the app — no catalog data is servable without a valid, non-expired session.
- **Pagination — keyset in browse mode, offset in search mode**: browse-mode pagination
  uses a keyset cursor on `id` (`WHERE id > cursor.lastId ORDER BY id ASC`), which stays
  flat in performance at page 200 as at page 1 — the property that matters for a
  3,000+-row dataset (`OFFSET 6000` on a plain offset scheme gets progressively more
  expensive; a keyset cursor never scans past what it returns). Search-mode pagination
  uses plain `OFFSET`, a deliberate trade-off: search results are ranked by trigram
  similarity rather than `id`, and the filtered result set is naturally much smaller than
  the full unfiltered browse case that keyset pagination is protecting against.
- **Page size**: client-controlled via `?limit=`, validated server-side (`@Min(5) @Max(50)
  @IsInt`), rejecting out-of-range or non-integer values with `400` — not silently
  clamped.
- **Category filter**: validated against a fixed allowlist (kept in sync with the seed
  script's category list on both frontend and backend), rejecting unknown categories with
  `400` rather than silently returning an empty result set.
- **Search**: case-insensitive, via PostgreSQL's `pg_trgm` extension — a GIN trigram index
  on both `name` and `description`, ranked by `GREATEST(similarity(name, q),
  similarity(description, q))` descending.
  - **Why trigram over `ILIKE '%q%'`**: `ILIKE` with a leading wildcard can't use a
    standard B-tree index at all — it's an O(n) sequential scan regardless of dataset
    size. The GIN trigram index makes substring/fuzzy matches genuinely indexed.
  - **Why trigram over full-text (`tsvector`)**: `tsvector`/`ts_rank` gives better
    linguistic relevance ranking (stemming, stop words) but is materially worse at
    partial-word and typo tolerance — which matters more for a product search box where
    users type fragments ("chair" should match "Chairs", "Armchair") than for prose
    search. Given the choice for this dataset, fuzzy substring matching felt like the more
    "outstanding search experience" default; a real system would likely combine both.
  - At the current seed scale (~3,020 rows), Postgres's planner may legitimately choose a
    sequential scan over the trigram index anyway (the whole table fits in a few pages) —
    the index becomes load-bearing at realistic production catalog sizes, not
    necessarily visible in `EXPLAIN` at this demo scale.
- **Sponsored items** (bonus — treated as required per reviewer instruction, not
  optional):
  - Positions 5, 10, 20, 40, 80, 160, ... (1-indexed within the *organic* browse list;
    the gap doubles after the first). Implemented as a pure, independently unit-tested
    function (`getSponsoredSlotsInRange`) before it was ever wired into the endpoint —
    this was the single most fiddly-to-get-subtly-wrong piece of the assignment, since
    positions must stay correct across page boundaries (a global running count, not reset
    per page) for the doubling sequence to hold.
  - Sponsored items are a regular `products` row flagged `isSponsored`, not a separate
    table — conceptually just promoted products, so a flag avoids duplicating the whole
    schema for the same entity.
  - They do **not** count toward the requested `limit` (fetched as a genuine addition on
    top of the organic page) and do **not** affect the pagination cursor (which only
    tracks organic progress) — verified by e2e tests asserting the organic count stays
    exactly at the requested limit regardless of how many sponsored items got interleaved.
  - They respect the active category filter (a real bug caught during manual testing: the
    sponsored pool originally ignored it, so browsing "Books" could surface an unrelated
    Electronics ad — fixed to filter the sponsored pool by category too; if a category has
    no sponsored inventory, its slots simply go unfilled).
  - Never shown in search mode, per spec.
  - Visually distinguished with an amber border + "Sponsored" badge, not just a subtle
    color change.
  - **Abuse prevention, given more time** (asked for explicitly by the spec): duplicate
    sponsored items showing back-to-back across adjacent slots could be prevented by
    tracking which sponsored id was last shown and excluding it from the next slot's
    candidate pool; layout shift could be avoided by reserving the row's height before the
    sponsored item's content loads (not a concern here since data is same-request, but
    would matter with lazy-loaded ad creative); click fraud would need server-side
    impression/click logging with per-session or per-IP rate caps on how many sponsored
    clicks count toward billing, plus anomaly detection on suspiciously high click-through
    from a single source.

## Testing strategy

- **Backend**: 30 unit tests (pure functions — sponsored-slot math, cursor encoding,
  rate limiter, session guard, credential validation — each independently verified before
  being wired into the endpoints that use them) + 20 e2e tests (real HTTP requests via
  `supertest` against the actual NestJS app and a real Postgres connection: full login/
  session/rate-limit/logout flows, and full catalog pagination/filter/search/sponsored-
  slot behavior). Run with `cd backend && npm test && npm run test:e2e`.
- **Frontend**: one Playwright e2e spec (`frontend/e2e/app.spec.ts`, 8 tests) driving a
  real headless Chromium against the real dev servers + seeded DB: unauthenticated
  redirect, wrong-credentials error state, successful login, sponsored item rendering,
  search hiding sponsored items, category filtering, infinite scroll staying DOM-bounded
  (virtualization), and logout revoking access. Run with `cd frontend && npm run
  test:e2e` (frontend + backend + seeded DB must already be running).
  - **Why Playwright e2e over a Jest/RTL component-test harness**: no component-test setup
    existed yet, and every bug this build actually hit was integration-shaped — a CSS
    layout interaction breaking virtualization, a cookie-lifecycle bug in logout — not
    something a mocked component render would have exercised. Given the time budget, one
    real, thorough e2e pass over the whole journey had a better bug-catching-to-effort
    ratio than shallow mocked unit tests for presentational components. This is the
    honest trade-off, not an oversight: with more time, I'd add both.

## Trade-offs & what I'd do differently with more time

- **Single-instance assumptions**: the session store and the login rate limiter are both
  scoped to one running backend process (Postgres-backed sessions survive restarts, but
  the rate limiter is in-memory and doesn't share state across instances). Fine for this
  scope; the real answer for a horizontally-scaled deployment is Redis for both.
- **Search v2**: combine trigram fuzzy matching with `tsvector` relevance ranking, or an
  external engine (Meilisearch/Typesense) for a genuinely state-of-the-art search
  experience at larger scale.
- **No product images**: `ProductCard` renders a deterministic pastel color+initial swatch
  hashed from the product name rather than a real image — no real images are seeded/
  hosted, keeping everything self-contained and offline-friendly. A real build would seed
  actual (or at least placeholder-service) images.
- **Category list duplication**: the 15-category allowlist is hardcoded in both
  `backend/src/catalog/dto/get-products-query.dto.ts` and `frontend/src/lib/categories.ts`
  rather than served from a `GET /categories` endpoint — no such endpoint exists (out of
  spec scope), so this is a small, deliberate duplication.
- **Dependency leanness**: the backend's runtime Docker image includes full
  `devDependencies` (not `--omit=dev`) because the seed script and `prisma.config.ts` both
  need `tsx` at runtime — a smaller image would split the seed step into its own build
  stage or precompile it.
- **Bleeding-edge tooling caution**: Prisma defaults to a new `prisma-client` generator
  (ESM-flavored output) as of 6.x/7.x; it threw `ReferenceError: exports is not defined`
  under Nest's standard CommonJS build. Rather than debug an unfamiliar new generator API
  under time pressure, I pinned to the classic `prisma-client-js` generator and Prisma
  6.19.3 (not the newly-released 7.x) — the long-established, unambiguous integration
  path. Similarly, this scaffold landed on Next.js 16.2.10, newer than most available
  reference material; I read the framework's own bundled migration docs
  (`middleware.ts` → `proxy.ts`, fully-async `params`/`searchParams`) before writing
  frontend code rather than assuming older conventions still applied.
- **Structured logging & account lockout**: deliberately deferred (see "Extras" below) —
  in scope for a production build, but lower-value than the four extras actually built for
  this submission's grading criteria.

## Improvements / enhancements beyond spec

- **Sliding-window inactivity timeout with an explicit, testable definition** — the spec
  asked us to define this explicitly; it's enforced by a guard with its own unit tests,
  not just documented.
- **Timing-safe login responses** (dummy bcrypt compare on the no-such-user path).
- **Session fixation prevention** (session id regenerated on login).
- **`Retry-After` header** on rate-limited login responses, not just a bare 429.
- **Keyset (not offset) pagination** for the browse case, specifically for the "backend
  query efficiency" grading criterion at the 3,000+-row scale the spec asks for.
- **Sponsored pool respects the active category filter** (see "Product catalog" above).
- **Virtualized infinite scroll** (`@tanstack/react-virtual`) — rendered DOM nodes stay
  bounded regardless of scroll depth, not just "loads more on scroll."
- **A full Playwright e2e suite**, run against both the local dev servers and the
  containerized Docker Compose stack.
- **Docker healthchecks and explicit startup ordering** (postgres → backend → frontend),
  not just `depends_on` for container creation order.

## Extras

Four additional enhancements were built after the initial 7-phase submission, each on its
own branch/PR (see "Development workflow" below):

- **CSRF protection** — double-submit cookie pattern: a non-`httpOnly` `csrf_token` cookie
  is set on login and must be echoed back in an `X-CSRF-Token` header on every
  state-changing request, checked against the session-stored copy. Closes the gap noted in
  "Authentication & sessions" (`sameSite=lax` alone).
- **Search autocomplete suggestions** — a new `GET /products/suggest` endpoint backs a
  keyboard-navigable dropdown on the search box. Ranked by trigram `word_similarity`
  (not `similarity`), specifically so short, while-you-type prefixes (e.g. `"cha"`) still
  match — plain trigram similarity scores those well below its default threshold because of
  the string-length mismatch, and returned nothing until this was caught by testing the
  live endpoint rather than only the "chair" happy path.
- **Search relevance highlighting** — the matched term is wrapped in `<mark>` within each
  result's name/description, falling back to plain text when the query isn't an exact
  substring (search is fuzzy, so it doesn't always have one).
- **Skeleton loading states** — `ProductCardSkeleton` mirrors the real card's exact
  dimensions during initial load and infinite-scroll fetches, replacing the old plain
  "Loading…" text and avoiding a layout shift when real content arrives.

**Deliberately deferred** (would do with more time): structured request logging and
account lockout after repeated failed logins. Both are reasonable production hardening,
but scored lower than the four extras above against this submission's actual grading
criteria, so they were left out rather than half-implemented.

### Feature flag

The three *visible* extras — autocomplete suggestions, search relevance highlighting, and
skeleton loading states — are gated behind a single flag,
`NEXT_PUBLIC_ENABLE_SEARCH_EXTRAS`, **defaulting to `true`** (any value other than the
literal string `"false"` counts as enabled; see `.env.example`). Disabled, the app falls
back to the original, pre-extras UI: a plain search input with no dropdown or highlighting,
and `"Loading…"` text instead of skeleton cards.

**How to disable it depends on how you're running the app**, because `NEXT_PUBLIC_*`
values are inlined into the client bundle at build time, not read at runtime (same caveat
as `NEXT_PUBLIC_API_URL` above):

- **Local dev server** (`npm run dev`): set `NEXT_PUBLIC_ENABLE_SEARCH_EXTRAS=false` and
  restart — picked up immediately, no rebuild needed.
- **Docker Compose**: set it in `.env`, then `docker compose up --build` (a plain `up`
  without `--build` reuses the already-built image and won't see the change) —
  `docker-compose.yml` passes it through as a build arg to `frontend/Dockerfile`.

CSRF protection is deliberately **not** behind this flag. It's a security fix, not a UX
toggle — shipping a build where it can be switched off would be a regression, not a demo
convenience — so it stays enabled unconditionally regardless of this setting.

## Credits

The search input's interaction pattern (debounce, clear button, focus ring, and — for the
autocomplete dropdown extra — keyboard navigation and outside-click close) is adapted from
an existing BurrowSoft product's search bar. No code, API keys, or external services are
shared between that product and this app — this project's search runs entirely against its
own seeded Postgres data, with no live external calls.

## Live deployment

Not provided. This was considered (mounting under an existing BurrowSoft production
domain) but deliberately skipped: the spec's actual deliverable is a public repo plus a
local `docker compose up`, and standing up a live route would have meant touching a real,
indexed, monetized production site for no graded benefit. Run it locally per "Getting
started" above.

## Environment variables

See [`.env.example`](.env.example) for the full list, each documented inline — database
credentials, session/rate-limit tuning, seed script knobs, and the frontend/backend origin
wiring. Copy it to `.env` before running `docker compose up`.

## Development workflow

Rather than one flat push, this repo was built as a stack of phase-scoped pull requests,
each merged in order with GitHub Copilot requested as a reviewer:

1. **Scaffold** — monorepo layout, gitignore, Next.js + NestJS bootstrap, docker-compose
   Postgres service.
2. **Data layer** — Prisma schema/migrations, `pg_trgm` search index, seed script.
3. **Auth & sessions** — login/logout, session guard with the explicit inactivity timeout,
   per-IP/per-account rate limiting.
4. **Catalog API** — sponsored-slot math and cursor encoding (as tested pure functions
   first), then the `GET /products` endpoint built on top of them.
5. **Frontend** — login page, auth-gating proxy, virtualized infinite-scroll catalog,
   Playwright e2e suite.
6. **Docker & docs** — full docker-compose stack, architecture diagram, this README.
7. **Lint cleanup** — a dedicated pass fixing every remaining eslint error, kept as its own
   PR so it didn't dilute the docs/Docker diff above with unrelated file-touches.

Each PR only ever depends on the one before it (a strictly sequential build, not
independent features), so the chain merges without conflicts by construction.

The four "Extras" above followed the same PR-with-Copilot-review pattern, but as
independent branches (not a stack) off an integration branch, `extras-release`, cut from
`main` after PR7 merged:

- `extra-csrf-protection`, `extra-autocomplete-suggestions`, `extra-search-highlighting`,
  and `extra-skeleton-loading` each branch directly off `extras-release` and PR back into
  it — independent of each other, since (unlike the 7 phases) these are genuinely
  unrelated features touching mostly-disjoint files.
- Once all four are reviewed and merged into `extras-release`, one final PR merges
  `extras-release` → `main`.
