# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Team Social Event Planner MVP: preferences → slots → rule-checked shortlist → vote → `.ics` invite. Specs live in the repo root (`Team Social Event Planner - 2h MVP Specification.md` is the one being built; the longer "Product & Technical Specification" is the deferred full version). No auth, mock calendar data, SQLite, runs without an API key.

## Commands

```bash
npm run dev                       # http://localhost:3000
npm test                          # vitest run (all projects)
npx vitest run path/to/file.test.ts          # single file
npx vitest run -t "name substring"           # single test by name
npm run test:watch
npm run typecheck                 # `next typegen && tsc --noEmit` (typegen must run first or PageProps/LayoutProps types fail)
npm run build
```

Node >= 22.12. Copy `.env.example` to `.env.local` for `ANTHROPIC_API_KEY`; Next also loads the repo-root `.env`, and anything `NEXT_PUBLIC_*` ends up in the browser bundle. Vitest does not load env files.

## Next.js version warning

This is Next 16 with breaking changes from what you may know. Before writing Next code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`, which `next dev` regenerates; commit it rather than deleting it).

## Architecture

Three streams, built in parallel against one frozen contract. **`workstreams/CONTRACT.md` is the source of truth** for types, the HTTP API, file ownership, scoring and tie rules. Each stream has its own `workstreams/<X>/imp_plan.md`. Do not edit another stream's files, and change `lib/types.ts` or the contract only via a PR agreed by all three.

| Stream | Owns | Role |
| --- | --- | --- |
| A engine | `lib/engine/**`, `data/*.json`, `tests/engine/**` | Pure, deterministic `planCandidates(ctx: PlanContext): PlanResult`: rules C1 to C5, slot finding, scoring, per-category shortlist. No HTTP, DB or Claude. |
| B backend | `lib/db.ts`, `lib/seed.ts`, `lib/explain.ts`, `lib/tally.ts`, `lib/ics.ts`, `app/api/**`, `tests/backend/**` | SQLite (better-sqlite3, plain SQL), `/api` routes, Claude explanations, vote tally, `.ics`. |
| C frontend | `app/(screens)/**`, `components/**`, `lib/api-client.ts`, `fixtures/**` | Five screens (`/me`, `/settings`, `/plan`, `/vote`, `/result`). |

Key seams:
- A to B: `planCandidates` and `lib/engine/data.ts` loaders. B reaches it through a single import seam (`lib/plan-provider.ts`) so a stub can stand in until A merges.
- B to C: the HTTP API. `lib/api-client.ts` is the only code allowed to call `fetch`; with `NEXT_PUBLIC_USE_MOCKS=1` it serves `fixtures/` instead.
- Claude (B's `explain`) only receives already-validated candidates and may only fill `explanation`. It never adds, edits or prices options. Any failure or missing key falls back to a deterministic template.
- `lib/types.ts` holds the shared types plus `CandidateSchema` (zod), which must stay identical to `Candidate` (a compile-time assertion enforces this). `score` must be within 0..1, so clamp floating-point sums.

## Testing setup

Vitest 5 uses two `projects` in `vitest.config.mts`: any `*.test.ts` runs in Node, any `*.test.tsx` runs in jsdom with Testing Library and `tests/setup-dom.ts`. Tests are discovered anywhere in the repo, so colocated tests work. Helper or stub files must not be named `*.test.ts`. A `.ts` test needing a DOM can start with `// @vitest-environment jsdom`. `@/` aliases the repo root.

## Conventions worth knowing

- `data/app.db*` is git-ignored; `data/*.json` is read-only seed/config except `team.json`, which `PUT /api/team` rewrites.
- Rules are pure functions; hard rules (C1, C3 outdoor, C4, C5 same activity) filter, scored rules (C2 count, C5 category penalty) only affect score. Tie order everywhere: higher attendance, then lower price.
- Commits are per stream and independent; branch names are `ws-a-engine`, `ws-b-backend`, `ws-c-frontend`.
