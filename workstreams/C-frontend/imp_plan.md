# Workstream C: Frontend (5 Screens)

Branch: `ws-c-frontend`. Read `../CONTRACT.md` first. Spec sections: 5 (screens), 9 (demo script).

## Goal

The five screens, fully clickable end to end, built against the HTTP contract with local mocks so no backend or engine is needed to develop or demo.

## Owns

`app/(screens)/**`, `components/**`, `lib/api-client.ts`, `fixtures/**`. Do not touch `app/api/**` (B), `lib/engine/**` (A) or `lib/types.ts`.

## Dependency handling (so you can start now)

- `lib/api-client.ts` is the only place that calls `fetch`. One typed function per route in the contract, using the shared types.
- Mock mode: when `NEXT_PUBLIC_USE_MOCKS=1`, the client returns data from `fixtures/*.json` and keeps vote and removal state in memory (module-level store). Fixtures must include a `Run` with candidates in at least 6 categories (and 2 empty categories), varied prices, one outdoor card with a weather string, one with `priceIsEstimate: true`, and a few members and past events.
- Remove mock mode at integration by unsetting the env var. No screen may import fixtures directly.

## Deliverables

1. **Shell**: layout with nav (Preferences, Settings, Plan, Vote, Result), a "current member" selector stored in `localStorage` (try/catch) and shared via a small context, loading and error states, Tailwind styling, usable at laptop width.
2. **`/me` Preferences**: member dropdown (from `GET /members`), category checkboxes for the 8 categories, tag input, save via `PUT /members/:id`; list of past events with a 1 to 5 rating control (`POST /ratings`) and the team average shown next to each. Never display other members' ratings or constraints.
3. **`/settings`**: form for limit, window days, attendance %, novelty weeks, with inline validation, saving via `PUT /team`, success and failure feedback.
4. **`/plan`**: "Run planning" button (`POST /plan`, spinner, disabled while running), shortlist grouped by category in a fixed order, empty categories shown as a muted "No options this run" note. Card shows activity name, price per person (with "estimate" marker when `priceIsEstimate`), slot date and time, attendance %, matched members by name, weather, criteria badges (C1 to C5, with the novelty penalty shown), explanation, source link (opens in a new tab with `rel="noopener noreferrer"`), and an organizer "Remove" action (`DELETE`, optimistic with rollback on error). Loads `GET /runs/latest` on mount.
5. **`/vote`**: for the current member pick a 1st, 2nd and 3rd choice from the run's candidates (three selects or rank buttons, no duplicates allowed), submit via `POST /votes`, editable until the next run. Live tally panel from `GET /votes/tally` (poll every 3 s or refetch after each submit) showing points and ballots cast. Drag to reorder is optional, skip it if short on time.
6. **`/result`**: winner card (same card component as `/plan`), ranked list with points, tie note when applicable, "Download invite (.ics)" linking to `GET /result/ics`, and a friendly state when no ballots exist.
7. **Shared components**: `CandidateCard`, `CategoryGroup`, `CriteriaBadges`, `RankPicker`, `TallyTable`, `Field`, `Spinner`, `ErrorBanner`. Reuse the same card on Plan, Vote and Result.

## Tests

Light and fast: Vitest plus React Testing Library for `CandidateCard` (estimate marker, badges, safe external link), `RankPicker` (no duplicate ranks) and `api-client` mock mode (vote then tally round trip). Manual walkthrough of the spec section 9 demo script in mock mode before handing off.

## Order of work

1. Mock data in `fixtures/`, `api-client.ts` with mock mode, shell and member context.
2. `CandidateCard` and `/plan` (the most reviewed screen), including Remove.
3. `/vote` and `/result` including the `.ics` link.
4. `/me` and `/settings`.
5. Polish: empty, loading and error states, responsive pass, a11y basics (labels, focus, button names).

## Commit plan

- `feat(ui): shell, api client, mock fixtures`
- `feat(ui): plan screen and candidate card`
- `feat(ui): vote and result screens`
- `feat(ui): preferences and settings screens`
- `test(ui): component and client tests`

## Definition of done

- With `NEXT_PUBLIC_USE_MOCKS=1`, the whole flow is clickable: set preferences, rate, run planning, remove a card, cast 3 ballots as different members, see the winner, click the `.ics` link.
- No component calls `fetch` outside `api-client.ts`; no screen reads fixtures directly.
- No type errors (`npx tsc --noEmit`) and component tests pass.
- Flipping mock mode off against B's routes needs no screen changes.

## Hand-off

Tell B which routes you exercised and note any field you wished the API returned differently, via a contract PR rather than a local workaround.
