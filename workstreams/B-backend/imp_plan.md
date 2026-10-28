# Workstream B: Backend, Persistence, Agent Hand-off, Explain Fallback, Voting and Invite Export

Branch: `ws-b-backend`. Read `../CONTRACT.md` first (now **v2**, see its "Agent rules" and changelog) and `../A-engine/imp_plan.md` for the seam you consume. Spec sections: 4 (tables), 6 (run flow and guardrails), 5 (voting and result rules), 2 (stack).

## Goal

Every HTTP route in the contract, SQLite persistence, planning through A's agent, the explain fallback, vote tallying and the `.ics` export. Works with no API key.

What v2 changed for B: `POST /plan` now calls `runPlanningAgent` (a Claude tool loop owned by A, with a deterministic fallback) instead of `planCandidates` plus a Claude explain call. B persists `Run.discovered`, resolves every `activityId` through `resolveActivity`, and runs `explain()` only on the fallback path.

## Owns

`lib/db.ts`, `lib/seed.ts`, `lib/explain.ts` (fallback path only), `lib/tally.ts`, `lib/ics.ts`, `lib/plan-provider.ts`, `app/api/**`, `tests/backend/**`. Do not touch `lib/engine/**` (A) or UI files (C). Only `lib/explain.ts` (and A's `lib/engine/agent/**`) may import `@anthropic-ai/sdk`.

## Status (as of the v2 merge)

Done on `ws-b-backend`, 71 tests green, no API key needed:

- SQLite schema and idempotent seed, all 14 routes, tally, `.ics`, explain with template fallback, plan provider seam with a v1 stub. Merged with `main` including the explain eval suite in `evals/explain/` (offline graders pass).
- Smoke-tested every route against `npm run dev` with `ANTHROPIC_API_KEY` unset.

Open: the v2 changes below. `npm run typecheck` currently fails in four places, all the missing `discovered` field on `Run` and `PlanResult` (`app/api/_lib/runs.ts`, `lib/db.ts`, `tests/backend/db.test.ts`, `tests/backend/stubs/plan.ts`).

## Dependency handling (A is not on `main` yet)

`main` has the v2 types and contract but not A's `lib/engine/**` or `data/*.json`. Keep the throwaway stub, and bring it up to v2:

- `tests/backend/stubs/plan.ts` exports the full seam B imports: `runPlanningAgent(ctx, opts?)` returning an `AgentResult` (`mode: "fallback"`, `trace: []`, zero `usage`, `gaps: []`, `discovered: []`), `planCandidates`, `resolveActivity`, `loadActivities`, `loadBusy`, `loadForecast`.
- The stub can also return `mode: "agent"` with a non-empty `discovered` and agent-written explanations when a test asks for it (a `stubAgent({ mode, discovered })` factory), so the agent path is covered before A lands.
- `lib/plan-provider.ts` is the only file that names the stub. It re-exports `runPlanningAgent`, `planCandidates`, `resolveActivity`, `loadActivities`, `loadBusy`, `loadForecast`. At integration, point it at `@/lib/engine/agent/index`, `@/lib/engine/index` and `@/lib/engine/data`, delete the stub, and run the full suite.
- Local fixtures in `tests/backend/fixtures/` stay until A pushes `data/*.json`; `lib/seed.ts` already prefers `data/` when present.

## Deliverables

1. **SQLite** (`lib/db.ts`, `lib/seed.ts`): five tables as in spec section 4, file at `data/app.db` (git-ignored). `run` carries two JSON columns beyond the spec: `empty_categories` and, new in v2, `discovered`. Add an idempotent migration (check `PRAGMA table_info(run)`, `ALTER TABLE run ADD COLUMN discovered TEXT NOT NULL DEFAULT '[]'`) so a developer's existing `data/app.db` keeps working. `saveRun` and `getRun` round-trip `discovered`; `Run` returned by every route always has a `discovered` array. `vote` keeps its unique key on `(run_id, member_id, rank)`; re-voting replaces the ballot in one transaction.
2. **Members and ratings routes**: unchanged. `GET /members`, `GET`/`PUT /members/:id`, `GET /events` with `teamAvgRating`, `POST /ratings` (upsert, 1 to 5). Never return another member's rating or `constraints`.
3. **Team routes**: unchanged. zod validation, atomic write of `data/team.json`.
4. **Planning** `POST /plan` (changed in v2):
   1. Build the `PlanContext` from the team, members (with `constraints`, for the engine only), history, ratings, `loadBusy()`, `loadForecast`, and the catalog from `loadActivities()`.
   2. `const result = await runPlanningAgent(ctx)`. It never throws for model or tool failures; wrap it anyway and treat an unexpected throw as a 500 with `{error}`.
   3. Explain: call `explain()` only when `result.mode === "fallback"`, and for any candidate whose `explanation` is still empty. Agent-written explanations are kept as is. Pass the catalog plus `result.discovered` as the explain context so names and prices resolve.
   4. Validate every candidate with `CandidateSchema`, then persist the `Run` with `discovered: result.discovered`. Return the `Run` only.
   5. `trace`, `usage` and `gaps` are not part of `Run`. Log one line server-side (mode, tool calls, tokens, number of gaps) and do not add them to the response without a contract change.
   6. Latency: with a key the agent can take up to its 60 s cap (20 tool calls, 30000 tokens). Set `export const maxDuration = 90` on the route, and tell C that `POST /plan` can be slow with a key and instant without one.
   7. Guard against double clicks: one in-flight plan at a time (an in-memory promise lock). A second concurrent `POST /plan` awaits the first and gets the same `Run`, so it cannot start a second paid agent run.
   8. `opts.onProgress` is ignored in the MVP.
   - `GET /runs/latest` returns the run with `discovered`. `DELETE /runs/:runId/candidates/:candidateId` removes the candidate and its ballot rows and leaves `discovered` as is (an unreferenced entry is harmless and keeps ids resolvable).
5. **Activity resolution** (new in v2): everywhere B turns an `activityId` into an activity, use `resolveActivity(id, catalog, run.discovered)`. Never look only in `activities.json`. This covers tally ties (price), the `.ics` `SUMMARY`, and `explain` templates. `GET /events` stays catalog-only because past events are seeded from the catalog.
6. **Explain** `lib/explain.ts`: `explain(candidates, ctx, options?)` with `ctx = { activities, members }`. This matches the signature the `evals/explain/` adapter already uses.
   - Role after v2: fallback path only (no key, agent error, budget hit with nothing accepted) and any candidate left with an empty explanation.
   - Model `claude-sonnet-5-5`, key from `ANTHROPIC_API_KEY`, `max_tokens` 2000, one retry, `tool_choice: auto` (this model rejects forced tool use) with `strict: true`.
   - Claude never adds, removes, reprices or edits any field except `explanation`. Unknown ids ignored, first duplicate wins, empty or over-300-char text falls back to the template. Member names are never sent to Claude.
   - Template fallback is a pure function and satisfies the explain graders (`evals/explain/graders.ts`, H1 to H10): weather only for outdoor options with a forecast, long venue names cut at a sentence boundary, at most 300 characters.
   - Validate the final array with `CandidateSchema`.
7. **Voting** `lib/tally.ts` (pure) and routes: `POST /votes` (3 distinct, valid candidate ids from the run, one ballot per member), `GET /votes/tally`. Points 3, 2, 1. Ties: higher attendance, then lower price. `tallyVotes` takes a `priceOf` callback, so the caller passes a lookup built on `resolveActivity` with the run's `discovered`.
8. **Result and invite**: `GET /result` returns the winner and full ranking (`winner: null` when no ballots). `lib/ics.ts` builds a valid RFC 5545 `VEVENT` (UID, DTSTAMP, UTC DTSTART and DTEND, SUMMARY from the resolved activity name, DESCRIPTION with explanation and source URL, escaped commas and semicolons, CRLF, folding at 75 octets). `GET /result/ics` serves `text/calendar` with `Content-Disposition: attachment`. A discovered activity works the same way because the candidate carries `sourceUrl`.

## Tests (`tests/backend/`)

Existing (keep): tally, explain, ICS, DB and route cases, 38 backend cases today.

Add for v2:

- Agent path: a stub agent returning `mode: "agent"` with agent-written explanations means `explain()` is not called (spy), and the stored run keeps those explanations.
- Fallback path: `mode: "fallback"` means `explain()` runs and every candidate leaves with a non-empty explanation. A mixed result (some empty) explains only the empty ones.
- Discovered: a run with `discovered: [disc:...]` is persisted, returned by `POST /plan` and `GET /runs/latest`, and survives `DELETE` of another candidate.
- Resolution: tally tie-break uses the price of a discovered activity; `.ics` `SUMMARY` uses a discovered activity's name; explain template names a discovered activity.
- Run shape: every route returning a `Run` includes `discovered` (an empty array for catalog-only runs).
- Migration: an old-schema `run` table (no `discovered` column) opens, migrates, and old rows read back with `discovered: []`.
- Concurrency: two simultaneous `POST /plan` calls start one agent run and return the same run id.
- Unexpected throw from the agent: 500 with `{error}`, nothing persisted.
- Privacy: the context passed to the agent contains `constraints` for the engine, but no route response contains another member's `constraints`.

Definition of done counts `npm test` across the repo (the `evals/explain` offline suite included).

## Order of work

Done: 1 to 5 of the original order (db, routes, tally, ics, explain, plan routes), merged with `main`.

Remaining for v2:

1. Types fix: add `discovered` to the stub, `saveRun` / `getRun`, `createRun` and the tests; make typecheck green. Add the `run.discovered` column and migration.
2. Update the stub to the v2 seam (`runPlanningAgent`, `resolveActivity`) and `lib/plan-provider.ts` re-exports.
3. Rework `createRun`: call `runPlanningAgent`, explain only on fallback or empty explanations, persist `discovered`, in-flight lock, `maxDuration`, one log line.
4. Route tally, `.ics` and explain through `resolveActivity` with `run.discovered`.
5. New tests above.
6. Integration: swap the provider to A's real modules, run `npm test` and `npm run typecheck`, then the demo script in spec section 9 with the key unset and once with a key.

## Commit plan

Done:

- `feat(db): sqlite schema and seed`
- `feat(api): members, ratings, events, team routes`
- `feat(ai): explain with template fallback`
- `feat(vote): tally, ballots, result routes`
- `feat(ics): invite export`
- `feat(api): plan and run routes`
- `fix(ai): make explain template and merge pass the explain eval graders`

Next:

- `feat(db): persist Run.discovered with migration`
- `feat(api): plan through runPlanningAgent, explain on fallback only`
- `feat(api): resolve activities with resolveActivity in tally, ics and explain`
- `test(backend): agent path, discovered activities, concurrency`
- `chore(integration): point plan-provider at the real engine` (when A merges)

## Definition of done

- `npm test` green (backend, engine and the offline explain evals), and `npm run typecheck` clean.
- Every route in the contract responds with the documented shape (check against `npm run dev`); `Run` always includes `discovered`.
- Full backend flow works with `ANTHROPIC_API_KEY` unset (agent falls back, template explanations).
- With a key, `POST /plan` returns `mode: "agent"` results with agent-written explanations inside A's caps, and `explain()` is not called.
- The `.ics` imports into Outlook with the right time and title (manual check at integration), including for a discovered activity.

## Contract questions to settle with A and C

1. **`trace`, `usage`, `gaps`**: not in `Run`, so not persisted or returned. If the team wants a "why this option" view, we need a contract change (a `run.trace` JSON column and a field on `Run`).
2. **Tally and result with no ballots**: `/votes/tally` lists every candidate with zero points, and `/result` returns `winner: null` with the full ranking. The contract does not say; C should confirm the UI expects it.
3. **Slot timezone**: `.ics` needs `slotStart` and `slotEnd` to carry an offset or `Z`. A should confirm the slot format.
4. **`explain()` signature**: second argument `{ activities, members }` is an additive deviation from the v1 plan; the explain evals already assume it. Confirm it as part of the contract.
5. **`run.empty_categories`**: an extra column beyond spec section 4, needed so `Run.emptyCategories` round-trips.

## Hand-off

- To C: the routes as implemented (unchanged URLs), `Run.discovered` is now always present, and `POST /plan` can take up to about a minute with a key. Add `discovered: []` to fixtures.
- To A: the exact seam B imports (`runPlanningAgent`, `planCandidates`, `resolveActivity`, `loadActivities`, `loadBusy`, `loadForecast`) and that `lib/plan-provider.ts` is the single switch-over point.
- Publish the final route list as implemented; any deviation from the contract goes through a contract PR.
