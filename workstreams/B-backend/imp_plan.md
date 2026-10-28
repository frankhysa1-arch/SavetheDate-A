# Workstream B: Backend, Persistence, AI Explanations, Voting and Invite Export

Branch: `ws-b-backend`. Read `../CONTRACT.md` first. Spec sections: 4 (tables), 6 (run flow and guardrails), 5 (voting and result rules), 2 (stack).

## Goal

Every HTTP route in the contract, SQLite persistence, the Claude explain step with a template fallback, vote tallying and the `.ics` export. Works with no API key.

## Owns

`lib/db.ts`, `lib/seed.ts`, `lib/explain.ts`, `lib/tally.ts`, `lib/ics.ts`, `app/api/**`, `tests/backend/**`. Do not touch `lib/engine/**` (A) or UI files (C).

## Dependency handling (so you can start now)

A delivers `planCandidates` and `data/*.json`. Until A merges, create a throwaway stub in `tests/backend/stubs/plan.ts` that returns a hand-written `PlanResult` and inject it through a single import seam (`lib/plan-provider.ts`, owned by you, re-exports the engine or the stub). Swap to the real engine at integration. Use small local fixtures in `tests/backend/fixtures/` for members and events until A pushes the real seed files.

## Deliverables

1. **SQLite** `lib/db.ts`, `lib/seed.ts`: `better-sqlite3`, plain SQL, file at `data/app.db` (git-ignored). Five tables exactly as in spec section 4: `member`, `rating`, `event`, `vote`, `run`. Idempotent `seed()` loads `data/members.json` and `data/past-events.json` on first start. `vote` has a unique key on `(run_id, member_id, rank)`; re-voting deletes the member's old ballot in one transaction.
2. **Members and ratings routes**: `GET /members`, `GET`/`PUT /members/:id`, `GET /events` with `teamAvgRating`, `POST /ratings` (upsert per member and event, validate 1 to 5). Never return another member's rating or `constraints`.
3. **Team routes**: `GET`/`PUT /team`, validating with zod and writing `data/team.json` atomically (write temp file then rename). Reject nonsense (negative limit, threshold over 100).
4. **Planning** `POST /plan` per spec section 6: load team, members, history, ratings, busy, forecast loader; call `planCandidates`; call `explain()`; persist the run; return `Run`. `GET /runs/latest`. `DELETE /runs/:runId/candidates/:candidateId` removes one candidate from the stored run (also drop any ballots naming it).
5. **Explain** `lib/explain.ts`: `explain(candidates): Promise<Candidate[]>`.
   - Model `claude-sonnet-5-5`, key from `ANTHROPIC_API_KEY`, `max_tokens` 2000, one retry.
   - Input is the validated candidates only; output via a tool-use schema `{id, explanation}[]`.
   - Merge by id. Claude never adds, removes, reprices or edits any other field. Unknown ids are ignored, missing ids get the template.
   - Template fallback (no key, API error, malformed output): deterministic sentence built from price, attendance, matched member names, weather. Fallback must be a pure function with its own tests.
   - Validate the final array with `CandidateSchema`.
6. **Voting** `lib/tally.ts` (pure) and routes: `POST /votes` (3 distinct, valid candidate ids from the run, one ballot per member), `GET /votes/tally`. Points 3, 2, 1. Ties: higher attendance, then lower price (price comes from the activity catalog via `activityId`).
7. **Result and invite**: `GET /result` returns the winner and the full ranking; `winner: null` when no ballots. `lib/ics.ts` builds a valid RFC 5545 `VEVENT` (UID, DTSTAMP, DTSTART and DTEND in UTC, SUMMARY from the activity name, DESCRIPTION with explanation and source URL, escaped commas and semicolons, CRLF line endings, line folding at 75 octets). `GET /result/ics` serves it as `text/calendar` with `Content-Disposition: attachment`.

## Tests (`tests/backend/`, at least 15 cases)

- Tally: points math, ties broken by attendance then price, partial ballots, re-vote replaces.
- Explain: no key returns templates, mocked SDK success merges only explanations, malformed or extra ids ignored, retry once then fall back, original candidate fields unchanged (deep equal).
- ICS: required properties present, CRLF, escaping, folding, correct UTC conversion from the slot.
- DB and routes (in-memory SQLite): seed is idempotent, rating upsert, privacy (no other member's data leaks), plan route persists and `latest` returns it, delete removes candidate and its votes, team PUT validation.

## Order of work

1. `db.ts`, `seed.ts`, members/ratings/events/team routes.
2. `tally.ts` plus tests, votes and result routes.
3. `ics.ts` plus tests, `/result/ics`.
4. `explain.ts` with fallback plus tests.
5. `/plan` and run routes wired through the plan provider seam; swap stub for the real engine when A merges.

## Commit plan

- `feat(db): sqlite schema and seed`
- `feat(api): members, ratings, events, team routes`
- `feat(vote): tally, ballots, result routes`
- `feat(ics): invite export`
- `feat(ai): explain with template fallback`
- `feat(api): plan and run routes`

## Definition of done

- `npm test` green for `tests/backend`, 15 or more cases.
- Every route in the contract responds with the documented shape (check with curl against `npm run dev`).
- Full backend flow works with `ANTHROPIC_API_KEY` unset.
- The `.ics` imports into Outlook with the right time and title (manual check at integration).

## Hand-off

Publish the route list as implemented (any deviation from the contract goes through a contract PR) and tell C when the routes are reachable so C can turn off mock mode.
