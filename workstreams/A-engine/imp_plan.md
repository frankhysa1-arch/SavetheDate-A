# Workstream A: Rules Engine and Data

Branch: `ws-a-engine`. Read `../CONTRACT.md` first. Spec sections: 3 (rules), 4 (data), 6 steps 2 to 5.

## Goal

A pure, deterministic, fully tested function `planCandidates(ctx)` that turns team data into a rule-checked, scored, per-category shortlist. No HTTP, no DB, no UI, no Claude calls.

## Owns

`lib/engine/**`, `data/*.json`, `tests/engine/**`. Do not touch anything else.

## Deliverables

1. **Seed data** in `data/`:
   - `activities.json`: 40 items covering all 8 categories (at least 4 per category, mix of indoor/outdoor, prices from 0 to above 40 so C1 bites, a few `priceIsEstimate: true`, real-looking `sourceUrl`).
   - `team.json`: defaults from spec section 3 (limit 40, EUR, 14 days, 120 min, 55%, 6 weeks, weekday 17:30 to 20:00 and Sat 12:00 to 16:00).
   - `members.json`: 8 members with categories, tags, empty constraints.
   - `past-events.json`: 3 events (one within 6 weeks so C5 has something to reject, one older than 6 weeks, one for the category penalty).
   - `busy.json`: free/busy for the 8 members over the next 14 days, designed so some slots clear 55% and some do not, including one slot at exactly 55%.
   - `forecast.json`: 14 days, including at least one bad day (rain 41% or more) and one hot or windy day.
2. **Loaders** `lib/engine/data.ts`: `loadTeam`, `loadActivities`, `loadBusy` (this is the `getBusy()` interface that Graph replaces later), `loadForecast(dateISO)` (tries Open-Meteo free API with a short timeout, falls back to `forecast.json`, returns `null` when neither has the date).
3. **Rules** `lib/engine/rules.ts`, pure functions, one per rule:
   - `c1Price(activity, team)`: hard, `price <= limit` (equal passes).
   - `c2Preference(activity, members)`: returns `{matched: memberIds, pass: matched.length >= 2}`; a member matches on the activity id in tags or the category in categories.
   - `c3Weather(activity, forecast)`: indoor always passes; outdoor needs rain <= 40, 5 <= temp <= 32, wind <= 30; `null` forecast returns `null` (no hard fail, score only).
   - `c4Attendance(slot, team)`: `attendancePct >= threshold`.
   - `c5Novelty(activity, history, team, slotStart)`: hard fail if the same activity happened within `noveltyWeeks`; returns `penalty: true` if same category as the most recent event.
4. **Slots** `lib/engine/slots.ts`: `findSlots(team, members, busy, now)` generates slots inside the allowed time windows across `windowDays`, computes `availableMemberIds` and `attendancePct`, keeps those at or above the threshold, returns the top 5 by attendance then earliest start.
5. **Scoring** `lib/engine/score.ts`: `0.35P + 0.20R + 0.20A + 0.15N + 0.10B`. P = matched share of members, R = mean rating affinity for the activity's category (0 to 1, default 0.5), A = attendance share, N = 1 if category differs from the last event else 0, B = `1 - price/limit` clamped to 0..1.
6. **Shortlist and entry point** `lib/engine/index.ts`: `planCandidates(ctx)` crosses every activity with the top 5 slots, applies C1, C3, C4, C5 (and the C2 floor), scores survivors, keeps the best 2 per category, fills the `Candidate` shape with `explanation: ""`, builds the `weather` string, and reports `emptyCategories`. Deterministic ids (for example `${activityId}@${slotStart}`).

## Tests (`tests/engine/`, at least 20 cases, written before the glue code)

- C1: price equals limit passes, limit plus 1 fails.
- C2: exactly 1 member fails the floor, exactly 2 passes, category-only match counts, more matches score higher.
- C3: rain 40 passes and 41 fails for outdoor, 4 and 33 degrees fail, wind 31 fails, indoor passes in a storm, `null` forecast does not hard-fail.
- C4: exactly 55% passes, one member fewer fails.
- C5: same activity inside the window fails, outside passes, same-category penalty applies but does not drop the option.
- Slots: only allowed windows, nothing outside `windowDays`, sorted and capped at 5.
- Score: hand-computed fixture matches to 4 decimals, default rating 0.5 applied.
- Shortlist: at most 2 per category, `emptyCategories` correct, every candidate satisfies C1, C3, C4, C5.
- Property check: no output candidate ever violates a hard rule.
- Determinism: same context gives identical output.

## Order of work

1. Define the 8-category fixtures and write `activities.json`, `team.json`, `members.json`, `past-events.json` (push this early so B can seed from it).
2. Write failing tests for the rules, then implement `rules.ts`.
3. `slots.ts` plus `busy.json` and tests.
4. `score.ts` plus tests.
5. `index.ts` plus shortlist tests, then loaders and the Open-Meteo fallback.

## Commit plan (commit independently, push often)

- `feat(data): seed activities, team, members, past events` (push first, unblocks B)
- `feat(engine): rules C1-C5 with tests`
- `feat(engine): slot finder and busy/forecast loaders`
- `feat(engine): scoring and shortlist, planCandidates entry point`
- `test(engine): property and determinism checks`

## Definition of done

- `npm test` green for `tests/engine`, 20 or more cases.
- `planCandidates` on the seed data returns candidates in at least 6 of 8 categories.
- No candidate over the limit, on a bad-weather outdoor day, repeating a recent event, or under 55% attendance.
- No imports from `app/`, `components/`, `lib/db.ts` or the Anthropic SDK in `lib/engine/`.

## Hand-off

Tell B and C when `data/*.json` and the `planCandidates` signature are on your branch. If you must change a type, open a PR against `../CONTRACT.md` and `lib/types.ts` first.
