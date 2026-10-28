# Team Social Event Planner: Product & Technical Specification

Oct 28, 2026 · @Schuyler FREEMAN

## Summary and goals

The Social Event Planner is a web app where teammates record what they like, rate past events and share calendar availability. An agent then proposes a shortlist of activities across eight categories that fit the budget, the weather, the team's calendars and the team's history. The team votes, and the winning option goes out as an Outlook invite.

**Goals**

- Cut the organizer's effort from many messages and polls to one planning run and one vote.
- Raise attendance by only proposing slots where at least 55% of the team is free.
- Keep events varied by never repeating recent activities and by learning from ratings.

**Proposed success measures** (to confirm with the team)

| Measure | Target |
| --- | --- |
| Time from planning run to invite sent | Under 2 working days, including the vote |
| Share of shortlisted options that pass every hard rule | 100%, checked automatically |
| Categories with at least one valid option per run | 6 of 8 or more |
| Average post-event rating | Trending up over the first 3 months |

## Scope, users and assumptions

The first release is a standalone web app for one team, with a recommend, vote and invite flow, built by 2 to 3 developers over three stages.

**Users**

| Role | What they do |
| --- | --- |
| Team member | Fills in preferences, rates past events, votes on the shortlist |
| Organizer | Sets team settings (budget, area, time windows), starts a planning run, closes the vote, sends the invite |
| Admin | Manages team membership and the Microsoft Entra app registration |

**Decisions taken**

- Standalone web app. Microsoft Graph is used only for calendar availability and for sending the invite.
- Preferences and ratings are captured in forms inside the app.
- The agent recommends, the team votes, and the app sends an Outlook invite for the winning option.
- Work is split across 2 to 3 developers in three stages.

**Working assumptions** (confirm or correct)

- Budget and availability are hard rules. Shared preferences, weather fit, novelty and category coverage are scored. This is how the spec reads "one or more of" the six criteria.
- `team_limit` is a cost per person, in the team's currency.
- Availability means Outlook free/busy. Teams meetings live in the same Outlook calendar, so no separate Teams lookup is needed.
- Each team has one home area (city plus search radius) set by the organizer.
- Events are planned 1 to 3 weeks ahead, roughly one event per week or fortnight.

**Out of scope for the first release**

- Payments, ticket purchase or venue booking.
- Several teams or cross-team events.
- A native mobile app or a Teams app (the web app is mobile-friendly instead).

## Functional requirements

The app must capture preferences, find team-wide time slots, generate options in eight categories, check them against six criteria, run a vote and send the invite.

**Matching criteria**

| ID | Criterion | Rule | Type | Data source |
| --- | --- | --- | --- | --- |
| C1 | Cost | Estimated cost per person is at or under `team_limit` | Hard filter | Activity listing, or agent estimate flagged as estimate |
| C2 | Shared preference | At least 2 members list the activity or its category. More matches score higher | Scored, floor of 2 | Member profiles |
| C3 | Weather fit | Outdoor options need a forecast within the team's thresholds (rain chance, temperature, wind). Indoor options always pass | Hard for outdoor when a forecast exists, else scored | Weather forecast for the area and slot |
| C4 | Availability | At least 55% of the team is free for the whole slot (configurable) | Hard filter | Outlook free/busy via Microsoft Graph |
| C5 | Novelty | Not the same activity or venue as any event in the last N weeks (default 6). Same category as the last event is penalised | Hard for exact repeats, scored for category | Event history |
| C6 | Category coverage | The shortlist offers options across sports, food, drinks, music, nature, art, physical activity and games | Shortlist rule | Agent output |

Past ratings feed C2 scoring: activity types the team rated 4 or 5 get a boost, types rated 1 or 2 a penalty.

**Requirements**

| ID | Requirement | Stage |
| --- | --- | --- |
| FR-01 | Members sign in with their Microsoft work account | 1 |
| FR-02 | Members set preferred categories, preferred activities (tags plus free text) and optional constraints such as alcohol-free or step-free access | 1 |
| FR-03 | Members rate each past event 1 to 5 with an optional comment | 1 |
| FR-04 | Organizer sets `team_limit`, currency, home area and radius, allowed days and time windows, event length, attendance threshold and novelty window | 1 |
| FR-05 | The system reads free/busy for all members over a date window and lists slots that meet C4 | 1 |
| FR-06 | The agent proposes up to 3 options per category, each tied to a slot, and applies C1 to C6 | 2 |
| FR-07 | Each option shows cost, slot, attendance %, members matched, weather summary, criteria met and a source link | 2 |
| FR-08 | Organizer can filter, remove or re-run options before opening the vote | 2 |
| FR-09 | Members vote by ranking their top 3. Organizer sets the deadline and sees live results | 3 |
| FR-10 | Organizer confirms the winner and the app sends an Outlook invite to all members | 3 |
| FR-11 | After the event, members are prompted to rate it, and the event is added to history | 3 |

## Agent design

Claude handles open-ended search and explanation, while plain code enforces every hard rule, so no option reaches the team without passing C1, C3, C4 and C5.

&#91;embedded content: planning run · 9 steps, 1 re-run loop\]

Slots and weather are known before the agent searches, so it looks for activities that fit a real time and forecast. Code re-checks everything the agent returns before scoring.

**Tools the agent can call**

| Tool | Purpose | Backed by |
| --- | --- | --- |
| `get_team_context` | Members, preferences, ratings, history, settings | App database |
| `find_slots` | Slots that meet the attendance threshold | Microsoft Graph `getSchedule` |
| `get_forecast` | Hourly forecast for the area and slot | Weather API |
| `search_places` | Venues by category, area and keywords | Places API |
| `search_events` | Ticketed events such as concerts and matches | Events API (to be chosen) |
| `web_search` | Fallback for prices and opening hours | Claude web search tool |
| `submit_candidates` | Returns options as JSON for validation | App, schema-validated |

**Scoring** (starting weights, tuned in Stage 2)

```latex
\text{score} = 0.35\,P + 0.20\,R + 0.20\,A + 0.15\,N + 0.10\,B
```

P is the share of members whose preferences match. R is rating affinity for that activity type, from 0 to 1. A is the attendance share for the slot. N is 1 when the category differs from the last two events, else 0. B is budget headroom, 1 minus cost over `team_limit`.

**Guardrails**

- Every option carries a source URL and either a listed price or an explicit "estimated" flag.
- The validator rejects options with missing fields, unknown venues or slots outside the run window.
- Each run has a cap on tool calls and tokens, and logs every tool call for review.
- Model: Claude Sonnet 5.5 through the Claude API with tool use, either via the Claude Agent SDK or a simple tool loop.

## Architecture and tech stack

Use one language (TypeScript) end to end so 2 to 3 developers can move across frontend, API and agent work without context switching.

&#91;embedded content: system architecture · 4 parts, 5 external services\]

Planning runs take minutes, so the API queues them and the agent worker reports progress back. Only the API server talks to Microsoft Graph, which keeps calendar permissions in one place.

| Layer | Suggested choice | Notes |
| --- | --- | --- |
| Frontend | Next.js (React, TypeScript) with a component library such as shadcn/ui | Sign-in with MSAL. Mobile-friendly layouts |
| API server | Node.js with TypeScript (Next.js route handlers or Fastify) | REST with an OpenAPI schema agreed in week 1 |
| Agent worker | Node.js worker with a job queue (BullMQ on Redis, or a Postgres-backed queue) | Claude API with tool use. Streams progress events to the UI |
| Database | PostgreSQL with Prisma or Drizzle | Migrations in the repo |
| Identity | Microsoft Entra ID app registration, OpenID Connect | Delegated Graph permissions, admin consent if the tenant requires it |
| Hosting | Azure App Service or Container Apps, Azure Database for PostgreSQL, Key Vault | Sits next to Entra ID and Graph. Any cloud works if the team prefers |
| Quality | GitHub Actions, unit tests on rules and scoring, an agent evaluation set | Rules and scoring are pure functions, easy to test |

If the team prefers Python for the agent, a FastAPI worker is a sound alternative. Keep the shared candidate JSON schema as the contract either way.

## Data model

Eight tables cover the full loop from preferences to rated events. `Candidate` is the contract between the agent worker and the rest of the app.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Team | id, name, home\_location (lat, lon, label), radius\_km, team\_limit, currency, min\_attendance\_pct (default 55), novelty\_weeks (default 6), allowed\_days, time\_windows, event\_length\_min, weather\_thresholds | One row per team. Edited by the organizer |
| Member | id, team\_id, entra\_object\_id, email, display\_name, role (member, organizer, admin), preferred\_categories\[\], preferred\_tags\[\], free\_text, constraints\[\] | Constraints are optional and visible only to organizers |
| Activity | id, name, category, indoor (bool), venue\_name, address, lat, lon, price\_per\_person, price\_is\_estimate, source, source\_url | Stored once found, reused across runs |
| PlanningRun | id, team\_id, window\_start, window\_end, status, created\_by, tool\_call\_count, token\_usage, started\_at, finished\_at | One per click on "Plan an event" |
| Candidate | id, run\_id, activity\_id, slot\_start, slot\_end, attendance\_pct, available\_member\_ids\[\], matched\_member\_ids\[\], weather\_summary, criteria (C1 to C5 pass or score), score, explanation, status (proposed, removed, shortlisted) | Written by the agent, validated by code |
| Vote | id, run\_id, member\_id, candidate\_id, rank (1 to 3), cast\_at | One ballot per member per run |
| Event | id, team\_id, activity\_id, run\_id, start, end, attendee\_ids\[\], graph\_event\_id | Created when the invite is sent. Drives the novelty check |
| Rating | id, event\_id, member\_id, score (1 to 5), comment, created\_at | Feeds rating affinity in scoring |

Calendar data is never stored. The app keeps only computed slots and attendance shares for the life of a run.

## UI screens and flows

Nine screens serve two journeys: members keep their profile current and vote, organizers run planning and send the invite.

| Screen | Who | What it shows and does | Stage |
| --- | --- | --- | --- |
| Sign in | All | Microsoft work-account sign-in | 1 |
| My preferences | Member | Pick categories, add activity tags and free text, set optional constraints | 1 |
| Rate past events | Member | List of attended events with a 1 to 5 rating and comment | 1 |
| Team settings | Organizer | Budget, currency, home area on a map, radius, days and time windows, thresholds | 1 |
| Plan an event | Organizer | Pick a date window, start a run, watch live progress (slots found, categories searched) | 1 basic, 2 live |
| Shortlist | Organizer | Options grouped by the eight categories. Each card shows cost, slot, attendance %, who matches, weather, criteria badges, source link. Remove, filter or re-run | 2 |
| Vote | Member | Shortlisted options with the same cards. Drag to rank top 3, see the deadline | 3 |
| Results and invite | Organizer | Ranked results, tie-break choice, preview of the Outlook invite, send | 3 |
| History | All | Past events, average rating, who attended | 3 |

**Design rules**

- Every option card explains itself: which criteria it meets and why, in one or two lines written by the agent.
- Members never see each other's constraints or individual ratings, only team averages.
- Layouts work on a phone, since most votes will be cast from one.

## External integrations

Six integrations are needed. Microsoft Graph and the weather API are low-cost and well documented; the activity data source is the main cost and quality decision.

| Integration | Used for | Key facts | Stage |
| --- | --- | --- | --- |
| [Microsoft Graph getSchedule](https://learn.microsoft.com/en-us/graph/api/calendar-getschedule?view=graph-rest-1.0) | Free/busy for every member over the run window | Returns free/busy status per slot without event details unless the calendar is shared. Up to 20 people per call and a window under 62 days ([overview](https://learn.microsoft.com/en-us/graph/outlook-get-free-busy-schedule)). Least-privileged permission is Calendars.ReadBasic in the beta table and Calendars.Read in older docs, so confirm against the current table | 1 |
| Microsoft Graph events | Sending the Outlook invite from the organizer's calendar | Create an event with attendees on the organizer's calendar. Needs Calendars.ReadWrite, delegated | 3 |
| [Open-Meteo](https://open-meteo.com/) | Hourly forecast for the area and slot | Hourly forecasts up to 16 days ahead, no API key. Free tier is for non-commercial use only, so an internal company tool likely needs the paid plan or another provider | 2 |
| [Google Places API (New)](https://developers.google.com/maps/billing-and-pricing/pricing) | Venues by category and area (restaurants, bars, climbing gyms, museums, parks) | Text Search Pro is listed at USD 32 per 1,000 calls after 5,000 free calls a month. Use field masks to stay on the cheapest tier | 2 |
| Events API (to be chosen) | Ticketed events: concerts, matches, exhibitions | Shortlist one provider in Stage 1 and check terms, coverage for the team's city and price data | 2 |
| Claude API | Agent reasoning, explanations, web search fallback | One run should stay within a fixed tool-call and token budget, set in config | 2 |

Prices and limits were read on 28 Oct 2026 and can change; re-check before committing to a provider.

## Delivery plan

The plan runs in three stages of about 8 to 9 weeks in total, and each stage ends with a working demo, so the team can stop after any gate with something usable.

&#91;embedded content: delivery roadmap · 3 stages, 3 gates\]

Stage 1 proves the hard rules on a hand-curated catalog of 30 to 50 local activities, before any paid search API is wired in. Stage 2 swaps the catalog for the live agent. Stage 3 closes the loop with voting, invites and ratings, then pilots with the team. Durations assume 2 to 3 developers working part time on the tool and are estimates, not commitments.

## Work split

Split by layer, not by feature: one developer owns the UI, one owns the API and integrations, one owns the agent and matching logic. Three shared contracts agreed in week 1 let all three work in parallel.

**Week 1 contracts (all developers)**

- [ ] OpenAPI schema for the REST endpoints, with mock responses for the UI
- [ ] Candidate JSON schema that the agent returns and the validator checks
- [ ] Database schema and seed data, including the curated activity catalog

| Stage | Dev A: Frontend and UX | Dev B: Backend and integrations | Dev C: Agent and matching |
| --- | --- | --- | --- |
| 1. Foundation | Sign-in flow, My preferences, Rate past events, Team settings, basic Plan an event | Repo, CI, hosting, Entra app registration, DB and migrations, REST API, Graph getSchedule and slot finder | Rules engine for C1, C4 and C5, scoring v1, seed catalog of 30 to 50 activities, unit tests |
| 2. Live agent | Shortlist screen with option cards, live run progress, filters and re-run | Job queue and worker hosting, weather, places and events API clients, caching, rate limits | Claude tool loop, tool definitions, C2, C3 and C6 logic, explanations, evaluation set and scoring tuning |
| 3. Vote, invite, pilot | Vote, Results and invite, History, mobile polish, accessibility pass | Voting API, Graph event creation, rating reminders, monitoring and cost caps, privacy review | Rating-driven learning, novelty tuning, prompt and tool hardening, pilot analysis |

**With two developers:** Dev A takes the frontend plus the API endpoints; Dev B takes the agent, rules and external integrations. Add about 2 weeks to the plan.

Each stage ends with a demo against its gate, and the tracker lives in the team's usual board.

## Non-functional requirements

The tool handles colleagues' calendars and preferences, so privacy and least privilege come first, followed by predictable cost.

| Area | Requirement |
| --- | --- |
| Privacy | Read free/busy only, never event subjects. Store computed slots, not calendars. Constraints and individual ratings visible to organizers only. Members can delete their profile. Review with the internal data protection contact before the pilot |
| Permissions | Delegated Graph permissions only, least privileged scope for each call, no application-wide calendar access |
| Security | Secrets in Key Vault or equivalent, never in code or prompts. Entra sign-in required on every route. Agent tools cannot write to the database except through `submit_candidates` |
| Prompt safety | Text from web pages and venue listings is treated as data. The agent cannot send messages or invites; only the API does, after the organizer confirms |
| Cost | Hard caps per run on tool calls, tokens and paid API calls. Cache venue and forecast lookups for 24 hours. Monthly spend shown to the admin |
| Performance | A planning run finishes in under 3 minutes for a team of up to 20, with progress shown throughout |
| Reliability | If one source fails, the run continues with the others and flags the gap. Runs can be resumed or re-run |
| Accessibility | WCAG 2.1 AA for all screens, keyboard-friendly ranking in the vote |
| Observability | Every run logs tool calls, rule results and scores, so any option can be traced back to its evidence |

## Risks and open questions

The biggest risk is activity data quality, especially prices; the biggest open decision is how strict the six criteria are.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Prices missing or out of date in listings | Options break the budget rule | Flag estimates on the card, let the organizer confirm price before the vote |
| Agent invents a venue or event | Loss of trust | Source URL required, validator checks it against the places or events result |
| Graph admin consent is slow to obtain | Stage 1 blocked on availability | Request the app registration in week 1, mock free/busy until approved |
| Forecast not available for slots more than 16 days out | Weather rule cannot run | Limit run windows to 14 days, or score outdoor options with a lower confidence |
| Paid API or licence costs exceed budget | Project stalls in Stage 2 | Seed catalog first, per-run caps, choose providers at Gate 1 |
| Low participation in ratings | Learning from history stays weak | One-tap rating prompt the day after the event |

**Open questions for the team**

- [ ] Is `team_limit` a per-person or a total budget, and does it include travel?
- [ ] How many weeks back should the no-repeat rule look (6 is assumed)?
- [ ] Is the home area fixed, or can the organizer pick a different city per event?
- [ ] Which days and time windows are allowed: lunchtime, after work, weekends?
- [ ] How are vote ties broken: organizer choice, higher attendance, or lower cost?
- [ ] Are there members outside the Microsoft tenant, such as contractors, who need access?
- [ ] Which events provider covers the team's city best?

## Sources

- [Microsoft Graph: calendar getSchedule (v1.0)](https://learn.microsoft.com/en-us/graph/api/calendar-getschedule?view=graph-rest-1.0)
- [Microsoft Graph: Get free/busy schedule of users and resources](https://learn.microsoft.com/en-us/graph/outlook-get-free-busy-schedule)
- [Open-Meteo](https://open-meteo.com/)
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
