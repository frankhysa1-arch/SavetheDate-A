# Shared Contract (v2)

All three workstreams code against this file. Change it only through a PR to `main` that all three owners approve. Source specs: `Team Social Event Planner - 2h MVP Specification.md` (rules, data, screens) and `Team Social Event Planner Product & Technical Specification.md` ("Agent design", the agent architecture). See "Changelog" at the end for what v2 changed.

## Step 0: shared scaffold (one person, ~10 min, commit to `main` before anyone branches)

Do this once, then A, B and C branch from it.

- Next.js (App Router, TypeScript), Tailwind, `vitest`, `better-sqlite3`, `zod`, `@anthropic-ai/sdk`. One `npm run dev`, one `npm test`.
- Empty folder skeleton: `lib/`, `lib/engine/`, `app/api/`, `app/(screens)/`, `components/`, `data/`, `tests/`, `fixtures/`.
- `lib/types.ts` containing exactly the types and zod schemas below.
- `.env.local` is git-ignored (`ANTHROPIC_API_KEY`). Never commit keys.
- Home page that renders and links to the 5 screens.

## Ownership (no two streams edit the same file)

| Stream | Owns | Branch |
| --- | --- | --- |
| A. Planning agent, rules engine and data | `lib/engine/**` (including `lib/engine/agent/**`), `data/*.json`, `tests/engine/**` | `ws-a-engine` |
| B. Backend, persistence, explain fallback, export | `lib/db.ts`, `lib/seed.ts`, `lib/explain.ts`, `lib/tally.ts`, `lib/ics.ts`, `app/api/**`, `tests/backend/**` | `ws-b-backend` |
| C. Frontend | `app/(screens)/**`, `components/**`, `lib/api-client.ts`, `fixtures/**` | `ws-c-frontend` |

`lib/types.ts`, `package.json` and config files belong to Step 0. If a stream needs a new dependency, add it in its own PR and keep that diff to `package.json` and the lockfile only.

## Types (`lib/types.ts`)

```ts
export const CATEGORIES = [
  "dining", "drinks", "outdoor", "sports",
  "culture", "games", "creative", "wellness",
] as const;                       // 8 categories, final for the MVP
export type Category = (typeof CATEGORIES)[number];

export interface Team {
  limit: number;                  // EUR per person, default 40
  currency: "EUR";
  windowDays: number;             // default 14
  eventLengthMin: number;         // default 120
  attendanceThresholdPct: number; // default 55
  noveltyWeeks: number;           // default 6
  city: string;
  timeWindows: { days: number[]; start: string; end: string }[]; // days 0=Sun..6=Sat, "HH:mm"
}

export interface Member {
  id: string; name: string;
  categories: Category[];         // liked categories
  tags: string[];                 // liked activity ids or free tags
  constraints: Record<string, unknown>; // private, never returned to other members
}

export interface Activity {
  id: string; name: string; category: Category; tags: string[];
  indoor: boolean; pricePerPerson: number; priceIsEstimate: boolean;
  sourceUrl: string;
}

export interface PastEvent { id: string; activityId: string; start: string; end: string } // ISO 8601
export interface Rating { id: string; eventId: string; memberId: string; score: 1|2|3|4|5 }

export type BusyMap = Record<string, { start: string; end: string }[]>; // memberId -> busy ISO ranges
export interface Forecast { date: string; rainPct: number; tempC: number; windKmh: number; summary: string }

export interface Slot {
  start: string; end: string;
  availableMemberIds: string[]; attendancePct: number;
}

export interface Candidate {
  id: string; activityId: string; slotStart: string; slotEnd: string;
  attendancePct: number; availableMemberIds: string[]; matchedMemberIds: string[];
  weather: string;
  criteria: { C1: boolean; C2: number; C3: boolean | null; C4: boolean; C5: boolean; C5penalty: boolean };
  score: number;                  // 0..1
  explanation: string;            // "" when produced by the engine, filled by stream B
  priceIsEstimate: boolean; sourceUrl: string;
}
// Export a zod `CandidateSchema` that matches `Candidate` exactly. `explanation` is "" from `planCandidates`; the agent fills it.

export interface PlanContext {
  team: Team; members: Member[]; activities: Activity[];
  history: PastEvent[]; ratings: Rating[]; busy: BusyMap;
  forecastFor: (dateISO: string) => Forecast | null;
  now: string;                    // ISO, injected so tests are deterministic
}
export interface PlanResult {
  candidates: Candidate[]; emptyCategories: Category[];
  discovered: Activity[];         // activities in `candidates` that are not in ctx.activities; ids start "disc:"
}

export interface ToolCallLog { tool: string; input: unknown; outputSummary: string; ms: number; error?: string }
export interface AgentUsage { toolCalls: number; inputTokens: number; outputTokens: number }
export interface AgentResult extends PlanResult {
  mode: "agent" | "fallback";     // "fallback" = planCandidates produced it
  trace: ToolCallLog[]; usage: AgentUsage;
  gaps: string[];                 // failed sources, dropped rows, caps hit
}

export interface Run {
  id: string; createdAt: string; candidates: Candidate[]; emptyCategories: Category[];
  discovered: Activity[];         // persisted with the run so every candidate.activityId resolves
}
export interface Ballot { runId: string; memberId: string; ranking: [string, string, string] } // candidate ids, best first
export interface TallyRow { candidateId: string; points: number; firstChoiceVotes: number }
```

## Seams between streams

| Seam | Provider | Consumer | Signature |
| --- | --- | --- | --- |
| Planning (agent) | A | B | `runPlanningAgent(ctx: PlanContext, opts?: AgentOptions): Promise<AgentResult>` from `lib/engine/agent/index.ts`. B's `POST /plan` calls this. It never throws for model or tool failures: it falls back to `planCandidates` and sets `mode: "fallback"` |
| Planning (deterministic) | A | B | `planCandidates(ctx: PlanContext): PlanResult` from `lib/engine/index.ts`. Rules and scoring core, and the agent's fallback |
| Activity lookup | A | B | `resolveActivity(id, catalog, discovered): Activity \| undefined` from `lib/engine/data.ts`. Used by tally ties, `.ics` and event names |
| Static data loaders | A | B | `loadTeam()`, `loadActivities()`, `loadBusy()`, `loadForecast(dateISO)` from `lib/engine/data.ts` |
| Seed content | A | B | `data/members.json`, `data/past-events.json` (B inserts them into SQLite) |
| HTTP API | B | C | Table below |

### HTTP API (JSON, all routes under `/api`)

| Route | Body / query | Returns |
| --- | --- | --- |
| `GET /members` | | `{id,name}[]` |
| `GET /members/:id` | | `Member` (only the caller's own record; no auth in MVP, `:id` is the "pick your name" choice) |
| `PUT /members/:id` | `{categories, tags}` | `Member` |
| `GET /events` | | `(PastEvent & {activityName, teamAvgRating: number\|null})[]` |
| `POST /ratings` | `{eventId, memberId, score}` | `{ok:true}` |
| `GET /team` | | `Team` |
| `PUT /team` | partial `Team` | `Team` |
| `POST /plan` | | `Run` |
| `GET /runs/latest` | | `Run \| null` |
| `DELETE /runs/:runId/candidates/:candidateId` | | `Run` |
| `POST /votes` | `Ballot` | `{ok:true}` (re-voting replaces the member's ballot) |
| `GET /votes/tally?runId=` | | `{rows: TallyRow[], ballotsCast: number}` |
| `GET /result?runId=` | | `{winner: Candidate \| null, ranking: (TallyRow & {candidate: Candidate})[]}` |
| `GET /result/ics?runId=` | | `text/calendar` attachment for the winner |

Errors: `{error: string}` with 4xx or 5xx. Members never see other members' ratings or constraints; only `teamAvgRating` is exposed.

### Agent rules (single source of truth)

- `AgentOptions = { client?: Anthropic; source?: ActivitySource; enableWebSearch?: boolean; budget?: Partial<Budget>; onProgress?: (e: { step: string; detail?: string }) => void }`. All optional; tests inject a scripted client.
- Only `lib/engine/agent/**` may import `@anthropic-ai/sdk`. The rest of `lib/engine/**` stays pure. No stream may import the SDK in `app/`, `components/` or other `lib/` files except B's `lib/explain.ts`.
- Claude receives tools and tool results only. It never writes the database, sends invites or messages, or sets `score`, `criteria`, `attendancePct`, `matchedMemberIds` or `weather`. Code computes those and re-checks C1, C3, C4, C5 on every row before it can enter a `PlanResult`.
- The agent writes `explanation` only (trimmed to 300 chars). On the fallback path `explanation` is `""` and B's `explain()` fills it. B calls `explain()` only when `mode === "fallback"` and for any candidate whose explanation is still empty.
- **Discovered activities**: an agent candidate may reference an activity that is not in the catalog only if it came from a `search_places` or `search_events` result in the same run. Code builds the `Activity` from that result (name, category, price, `sourceUrl` come from the tool result, not the agent), assigns the id `disc:<first 10 hex of sha1(sourceUrl)>`, and returns it in `PlanResult.discovered`. Price missing from the result: the agent's estimate is accepted only with `priceIsEstimate: true`. Category must be one of `CATEGORIES`.
- **Resolving `activityId`**: look in `data/activities.json` first, then in `Run.discovered` (`resolveActivity`). B persists `discovered` with the run (a JSON column on `run` is enough, no new table) and uses it for tally ties (price), `.ics` summary and event names. C never resolves ids itself; it only renders `Candidate`.
- Per-run caps (config, defaults): 20 tool calls, 30000 tokens, 60 s. Hitting a cap ends the loop; accepted rows are kept, otherwise fall back. Every tool call is logged in `trace`.
- `get_team_context` returns aggregates only. Never `constraints`, never an individual member's ratings.

### Scoring and tie rules (single source of truth)

- Score = `0.35P + 0.20R + 0.20A + 0.15N + 0.10B` (A owns the implementation).
- Vote points: rank 1 = 3, rank 2 = 2, rank 3 = 1 (B owns the implementation).
- Tie on points: higher `attendancePct`, then lower `pricePerPerson` (resolved with `resolveActivity`).
- Shortlist: best 2 candidates per category, tie order higher attendance then lower price (MVP; the full spec says 3, set in config).

## Integration (last, ~15 min, whoever finishes first)

1. Merge A, B, C into `main` in any order. File ownership is disjoint, so there should be no conflicts.
2. Run `npm test`, then the demo script in section 9 of the spec.
3. Turn off C's mock mode and fix any contract drift. Record fixes here.

## Changelog

- **v2** (agent as the core of Stream A, agreed by all three owners): added `runPlanningAgent` seam and `AgentResult`; `PlanResult.discovered` and `Run.discovered` for agent-found activities; `resolveActivity` seam; SDK import allowed under `lib/engine/agent/**` only; `explanation` filled by the agent with B's `explain()` as the fallback. Follow-ups: B updates `POST /plan`, persists `discovered`, and uses `resolveActivity` in tally and `.ics`; C adds `discovered: []` to its fixtures' `Run` objects.
- **v1**: initial frozen contract.
