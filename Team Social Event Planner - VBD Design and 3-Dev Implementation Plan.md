# Team Social Event Planner: VBD Design & 3-Developer Implementation Plan

Basis: `2h MVP Specification.md`. Method: Volatility-Based Decomposition (encapsulate what changes, not what the system does).

## 1. Volatility analysis

| # | Volatile area | Why it changes | Today (MVP) | Later | Encapsulated in |
| --- | --- | --- | --- | --- | --- |
| V1 | Calendar source | Auth model, tenant policy, provider | `busy.json` mock | MS Graph getSchedule | `CalendarAccess` |
| V2 | Activity source | Cost, licence, coverage | Curated JSON | Places + Events APIs | `ActivityAccess` |
| V3 | Weather source | Licence (Open-Meteo free = non-commercial) | Open-Meteo + JSON fallback | Paid/other provider | `WeatherAccess` |
| V4 | Invite channel | Outlook vs Teams vs Slack | `.ics` download | Graph event | `InviteAccess` |
| V5 | Persistence | Scale, hosting | SQLite | Postgres | `TeamAccess` |
| V6 | Matching rules & thresholds | Open questions C1–C6, team tuning | 6 rules, defaults | New rules | `MatchingEngine` |
| V7 | Scoring weights/formula | Tuned from ratings | Fixed weights | Learned | `ScoringEngine` |
| V8 | Slot-finding policy | Windows, attendance %, event length | Window grid | Smarter packing | `SlotEngine` |
| V9 | Reasoning/LLM | Model, prompt, agent loop | One explain call | Full tool loop | `ExplanationEngine` |
| V10 | Voting method & tie-break | Open question | Top-3 ranked | Approval, quorum | `TallyEngine` |
| V11 | UI | Framework, mobile/Teams app | Next.js | Teams tab | `Client` |
| V12 | Workflow sequence | New steps (budget approval) | Plan → Vote → Invite | More | Managers |

**Not volatile (kept stable):** domain nouns (Member, Activity, Slot, Candidate, Vote, Event), the Candidate schema, the three-step flow. These live in `contracts/` and are the only shared code.

## 2. Architecture (Löwy layers)

```
                    ┌────────────────────────┐
  Client            │ Web UI (Next.js pages) │   V11
                    └───────────┬────────────┘
                                │ REST (contracts/api.ts)
                    ┌───────────▼────────────┐
  Managers          │ PlanningManager        │   V12
  (workflow)        │ VotingManager          │
                    └──┬──────┬──────┬───────┘
          ┌────────────┘      │      └─────────────┐
  Engines │ SlotEngine V8     │ MatchingEngine V6  │ ScoringEngine V7
 (rules)  │ ExplanationEngine V9                   │ TallyEngine V10
          └────────────┬──────┴──────┬─────────────┘
  ResourceAccess  CalendarAccess V1  ActivityAccess V2  WeatherAccess V3
  (interfaces)    TeamAccess V5      InviteAccess V4
                                │
  Resources       busy.json · activities.json · Open-Meteo · SQLite · Claude API
  Utilities       zod schemas, config, logger, clock (cross-cutting)
```

**Call rules (enforced by review):**
1. Client → Managers only.
2. Managers → Engines & ResourceAccess. Managers never contain rules.
3. Engines are **pure** (data in, data out). They never call ResourceAccess, so they are testable with fixtures.
4. ResourceAccess exposes business-verb interfaces ("getFreeBusy"), never vendor shapes (no Graph types leak).
5. No sideways calls: Engine↔Engine, Access↔Access, Manager↔Manager (VotingManager reads runs via TeamAccess, not PlanningManager).
6. Claude only sees validated candidates, only inside ExplanationEngine.

**Swap test (acceptance of the design):** replacing mock calendar with Graph touches 1 file (`CalendarAccess` impl); changing voting to approval voting touches `TallyEngine` only; changing the threshold C4 touches config only.

## 3. Contracts (written together in the first 15 min, then frozen)

`contracts/types.ts` (zod-backed): `Member, Activity, Team, Slot{start,end,attendancePct,availableMemberIds}, Forecast{rainPct,tempC,windKmh,summary}, PastEvent, Candidate, Ballot, TallyResult`.

`contracts/interfaces.ts`:
```ts
interface CalendarAccess { getFreeBusy(memberIds: string[], from: Date, to: Date): Promise<Record<string, Interval[]>> }
interface ActivityAccess { listActivities(area: Area): Promise<Activity[]> }
interface WeatherAccess  { getForecast(area: Area, at: Date): Promise<Forecast | null> }
interface TeamAccess     { getTeam(); listMembers(); saveProfile(m); listPastEvents(); saveRating(r);
                           saveRun(run); getRun(id); saveBallot(b); listBallots(runId); saveEvent(e) }
interface InviteAccess   { createInvite(e: PastEvent, attendees: Member[]): Promise<{ filename: string; content: string }> }

// Engines (pure)
SlotEngine.find(busy, members, team): Slot[]
MatchingEngine.filter(activity, slot, forecast, history, team): { pass: boolean; criteria: Criteria }
ScoringEngine.score(activity, slot, members, ratings, history, team): number
ExplanationEngine.explain(candidates: Candidate[]): Promise<Candidate[]>   // template fallback, never throws
TallyEngine.tally(ballots, candidates): TallyResult
```

`contracts/api.ts`: `GET /api/members`, `PUT /api/members/:id`, `POST /api/ratings`, `GET|PUT /api/team`, `POST /api/plan` → `Run`, `DELETE /api/run/:id/candidates/:cid`, `POST /api/vote`, `GET /api/result/:runId`, `GET /api/invite/:runId` (.ics).

`contracts/fixtures/`: one golden `run.json` (24 candidates, 8 categories), `members.json`, `team.json`, `ballots.json`. **Every dev builds against these.**

## 4. Work split (by layer = by volatility boundary)

Zero shared files except `contracts/`. Each dev owns a directory.

### Dev A: Client + API routes (`/app`, `/components`)
Independent via `MOCK=1`: API routes return `contracts/fixtures/*` until Managers land.

| Min | Task | Done when |
| --- | --- | --- |
| 0–15 | Contracts (all) | Frozen, tagged `contracts-v1` |
| 15–35 | Next.js shell, member picker, `/me` preferences + ratings | Saves via mock API |
| 35–60 | `/plan` shortlist cards grouped by 8 categories, criteria badges, remove card | Renders golden `run.json` |
| 60–85 | `/vote` (rank top 3), `/result` (winner, .ics button), `/settings` | Flow clickable on fixtures |
| 85–105 | Switch `MOCK=0`, fix integration | Full flow on real backend |

Owns: all pages, API route handlers (thin: parse zod → call Manager → return). No logic.

### Dev B: ResourceAccess + Resources (`/access`, `/data`, `/db`)
| Min | Task | Done when |
| --- | --- | --- |
| 15–35 | SQLite schema, `TeamAccess` impl, seed script (8 members, 3 past events, ratings) | Contract tests pass against SQLite |
| 35–55 | `ActivityAccess` (40 activities across 8 categories, valid source URLs, ≥8 outdoor, mix of prices around limit) | Schema-valid |
| 55–70 | `CalendarAccess` mock (`busy.json`, deterministic, some slots at exactly 55%) | Returns intervals |
| 70–85 | `WeatherAccess` (Open-Meteo + `forecast.json` fallback, 24h cache, returns `null` on failure) `InviteAccess` (.ics RFC 5545, UTC times, attendees) | .ics imports into Outlook |
| 85–105 | Composition root `composition.ts` wiring (shared with C), integration fixes | Real data feeds Managers |

Each Access ships an in-memory fake + a contract test suite run against both fake and real.

### Dev C: Engines + Managers (`/engines`, `/managers`)
| Min | Task | Done when |
| --- | --- | --- |
| 15–40 | `MatchingEngine` C1–C5 + tests (price = limit, attendance exactly 55%, rain 41%, no forecast, repeat inside/outside window) | ≥15 tests green |
| 40–55 | `SlotEngine`, `ScoringEngine` + tests; C6 shortlisting (2/category) | Golden run reproducible |
| 55–75 | `ExplanationEngine` (Claude call via tool-use schema, `max_tokens` 2000, 1 retry, template fallback) `TallyEngine` (top-3 Borda, tie → attendance → cost) | Works with no API key |
| 75–90 | `PlanningManager`, `VotingManager` using fakes from B's contract | `POST /api/plan` on fakes returns valid `Run` |
| 90–105 | Wire to real Access, tune, README | Demo script passes |

## 5. Integration protocol

- **T+15** tag `contracts-v1`. After that, contract changes need a PR approved by all 3 (expect 0–2).
- **T+60** checkpoint: A renders fixtures, B's TeamAccess + fakes merged, C's Matching green. Mismatches fixed now.
- **T+85** merge to `main`, flip `MOCK=0`, run demo script together.
- Branches: `dev-a/*`, `dev-b/*`, `dev-c/*`. Merge to main by PR, CI = `tsc --noEmit` + `vitest`.
- Each dev's Claude Code session gets: the MVP spec, this doc, `contracts/`, and **only its own directory** as write scope.

## 6. Parallel-safety rules

1. Only `contracts/` is shared; edits by PR.
2. Cross-dev dependencies are always via interfaces + fakes, never by waiting on another dev's code.
3. Config (`config.ts`: thresholds, weights, windows) owned by C; others read only.
4. Vendor types never cross the Access boundary (A and C never see Graph/Open-Meteo shapes).
5. Prompts live in `engines/explanation/prompt.ts` only.

## 7. Acceptance (same as MVP spec §9, plus design checks)

- Demo script passes end to end, with and without `ANTHROPIC_API_KEY`.
- Swap tests: (a) replace `CalendarAccess` with a stub returning everyone busy → 0 candidates, UI shows empty state; (b) change `TallyEngine` tie-break in 1 file; (c) change `min_attendance_pct` in config only.
- `grep` shows no import from `access/` inside `engines/`, no `fetch`/SQL inside `managers/`.

## 8. Trade-offs & revisit later

| Decision | Trade-off | Revisit when |
| --- | --- | --- |
| Pure engines, orchestration in Managers | More wiring code, but rules testable without I/O | Never; core of design |
| Mock-first Access | Real-vendor surprises (Graph consent, Open-Meteo licence, price data) land late | Before pilot: Graph needs admin consent in week 1 |
| Contracts frozen at T+15 | Wrong guess costs a PR round | If >2 changes needed, re-plan |
| Synchronous run | Fine for ≤20 members; blocks request | Real APIs push run >30s → queue behind PlanningManager (no other change) |
| One Claude call, not agent loop | Cannot discover new venues | When ActivityAccess backed by live search: add loop inside ExplanationEngine/new `DiscoveryEngine` |
| Single team, no auth | Not shippable | Add Entra behind a `Session` utility; Client/Managers unchanged |
