# Team Social Event Planner: 2-Hour MVP Specification

Refined from the full spec (Oct 28, 2026). Built in one Claude Code session by one developer. Goal: a working demo of **preferences → slots → rule-checked shortlist → vote → invite file**, not a production system.

## 1. Cut list (what changes from the full spec)

| Full spec | 2h MVP |
| --- | --- |
| Entra sign-in, MSAL | "Pick your name" dropdown. No auth |
| Graph getSchedule | `data/busy.json` mock free/busy behind a `getBusy()` interface (Graph swap later) |
| Graph invite | Download `.ics` file for the winner |
| Places / Events APIs | Curated `data/activities.json` (40 items, all 8 categories) |
| Open-Meteo paid use | Open-Meteo free call (demo only), fallback to `data/forecast.json` |
| Postgres, queue, worker | SQLite file, synchronous run |
| Agent tool loop | One Claude call: explain + rank pre-validated candidates. Template text if no API key |
| Dev A/B/C split, 3 stages | Single dev + Claude, 4 timeboxed blocks |
| WCAG, Key Vault, monitoring, multi-run history | Out of scope |

Kept intact: the hard/scored rule split, pure-function rules, Candidate JSON contract, unit tests on rules.

## 2. Stack

- TypeScript, Next.js (App Router), Tailwind. One repo, one `npm run dev`.
- SQLite via `better-sqlite3` + plain SQL (no ORM).
- `vitest` for rules/scoring tests.
- `@anthropic-ai/sdk`, model `claude-sonnet-5-5`, key from `ANTHROPIC_API_KEY` in `.env.local`.

## 3. Rules (pure functions in `lib/rules.ts`)

| ID | Rule | Type |
| --- | --- | --- |
| C1 | `price_per_person <= team.limit` | Hard |
| C2 | ≥2 members list the activity or its category; more matches score higher | Floor 2 + scored |
| C3 | Outdoor: rain ≤ 40%, 5–32 °C, wind ≤ 30 km/h. Indoor always passes. No forecast → scored only | Hard (outdoor) |
| C4 | ≥55% of members free for the whole slot | Hard |
| C5 | Not same activity as any event in last 6 weeks (hard); same category as last event (penalty) | Hard + scored |
| C6 | Shortlist: up to 2 per category, 8 categories, report categories with zero options | Shortlist rule |

Score = `0.35P + 0.20R + 0.20A + 0.15N + 0.10B` (P preference match share, R rating affinity 0–1 default 0.5, A attendance share, N category differs from last event, B `1 - price/limit`).

Defaults in `data/team.json`: limit 40, currency EUR, window 14 days, event length 120 min, time windows weekday 17:30–20:00 and Sat 12:00–16:00.

## 4. Data (SQLite, 5 tables)

- `member(id, name, categories json, tags json, constraints json)`
- `rating(id, event_id, member_id, score 1-5)`
- `event(id, activity_id, start, end)` seeded with 3 past events
- `vote(id, run_id, member_id, candidate_id, rank)`
- `run(id, created_at, candidates json)`, candidates follow the schema below

Activities, team settings, busy data and forecast fallback are JSON files, read-only.

**Candidate schema** (validate with zod; agent output must conform)
```ts
{ id, activityId, slotStart, slotEnd, attendancePct, availableMemberIds[],
  matchedMemberIds[], weather: string, criteria: {C1..C5: boolean|number},
  score: number, explanation: string, priceIsEstimate: boolean, sourceUrl: string }
```

## 5. Screens (5)

1. **Preferences** `/me`: member dropdown, category checkboxes, tags, 1–5 rating of past events.
2. **Team settings** `/settings`: edit limit, window, attendance %, novelty weeks (writes `team.json`/DB).
3. **Plan** `/plan`: "Run planning" button → shortlist grouped by category; cards show price, slot, attendance %, matched members, weather, criteria badges, explanation, source link. Organizer can remove a card.
4. **Vote** `/vote`: pick top 3 per member (select ranks; drag is optional). Live tally.
5. **Result** `/result`: ranked winner (tie → higher attendance, then lower cost), button "Download invite (.ics)".

Members never see others' ratings or constraints; show team averages only.

## 6. Planning run flow (`POST /api/plan`)

1. Load team, members, history.
2. `findSlots()`: from `getBusy()` generate slots in allowed windows, keep those with attendance ≥ threshold.
3. `getForecast()` per slot day.
4. Cross every activity × top 5 slots → apply C1, C3, C4, C5 in code, drop failures.
5. Score survivors, take best 2 per category (C6).
6. One Claude call: input = survivors JSON; output = `{id, explanation}[]` via tool-use schema. Code merges explanations; on any failure use a template string. Claude never adds, edits or prices options.
7. Persist run, return candidates.

Guardrails: Claude receives only validated candidates, so it cannot invent venues; source URL comes from the catalog; call has `max_tokens` 2000 and 1 retry.

## 7. Timeboxed build plan (120 min)

| Min | Block | Done when |
| --- | --- | --- |
| 0–10 | Scaffold: Next.js, SQLite, vitest, seed JSON (40 activities, 8 members, busy data, 3 past events) | `npm run dev` shows home page |
| 10–45 | `lib/rules.ts`, `slots.ts`, `score.ts` + tests for C1–C6 | `npm test` green, ≥15 cases |
| 45–75 | `/api/plan`, Claude explain call with template fallback, Plan screen | Shortlist renders with ≥6 categories populated |
| 75–100 | Preferences, settings, vote, result, `.ics` export | Full flow clickable end to end |
| 100–120 | Run full flow, fix bugs, README with run steps and next steps | Demo script passes (below) |

If behind at minute 75, drop Settings screen (edit JSON by hand) and the remove-card action.

## 8. Claude Code working method

- Start with this file as context. First prompt: "Scaffold per sections 2 and 4, no features yet."
- One block per prompt; end each with "run tests, fix failures, show me the result".
- Write tests before wiring UI for rules (block 2), with fixtures for edge cases: price equals limit, attendance exactly 55%, repeat activity inside/outside novelty window, outdoor with rain 41%, no forecast.
- Commit after each block.

## 9. Acceptance (demo script)

1. Pick a member, set preferences, rate a past event.
2. Click Run planning → shortlist in ≥6 categories, no card over limit, no outdoor card on a bad-weather day, no card repeating a recent event, every card ≥55% attendance.
3. Remove one card, open vote, cast 3 ballots as different members.
4. Result page shows the winner; the `.ics` imports into Outlook with correct time and title.
5. `npm test` passes. App runs with no API key (template explanations).

## 10. Deferred to full spec

Entra auth, real Graph free/busy and invites, Places/Events APIs, Claude tool loop, queue/worker, Postgres, history screen, privacy review, accessibility, cost caps and monitoring.

## 11. Assumptions to confirm (defaults used if unanswered)

- `limit` is per person, no travel cost. Novelty window 6 weeks. One home city fixed in `team.json`. Ties: higher attendance, then lower cost. Team of ≤20, single tenant.
