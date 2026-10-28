# Eval: `explain()` (Workstream B, the only Claude call in the system)

Scope: `lib/explain.ts`, `explain(candidates) → candidates` with `explanation` filled. Claude may only write that one field, and only from facts it was given. Everything else (rules, scoring, tally) is deterministic and covered by unit tests, not evals.

## What is measured

| Tier | File | Runs in | Needs key | Purpose |
| --- | --- | --- | --- | --- |
| Grader self-test | `graders.test.ts` | `npm test` | no | Graders catch known-bad text |
| Offline | `explain.offline.test.ts` | `npm test` | no | Template fallback passes every grader on all 11 cases; mocked SDK: request shape, merge-only-explanation, unknown/duplicate/missing ids, malformed reply, retry once, double failure, no input mutation |
| Live | `explain.live.test.ts` | on demand | yes | Real model output vs hard graders, fallback rate, optional LLM judge |

`EVAL_LIVE=1 EVAL_RUNS=3 EVAL_JUDGE=1 npx vitest run evals/explain/explain.live.test.ts`
(skipped unless `EVAL_LIVE=1` and `ANTHROPIC_API_KEY` are set; Vitest does not read `.env`, export the key in the shell). Results land in `evals/explain/results/*.json` (git-ignored) with every failing text.

## Hard graders (100% required, `graders.ts`)

| ID | Rule |
| --- | --- |
| H1a–d | Same ids/order; only `explanation` changed; `CandidateSchema` valid; input not mutated |
| H2 | Non-empty, ≤300 chars, ≤2 sentences |
| H3 | Every number comes from the candidate or catalog (price, attendance, counts, slot parts, weather numbers for outdoor only) |
| H4 | Only matched members are named |
| H5 | Estimated prices are hedged; exact prices are not called estimates |
| H6 | Does not echo injected instructions from venue names |
| H7 | No URLs or emails (the card renders the source link) |
| H8 | Plain text: no markdown or newlines |
| H9 | Never claims "free" when price > 0 |
| H10 | No weather claims for indoor options or when there is no forecast |

## Soft quality (LLM judge, `judge.ts`, `EVAL_JUDGE=1`)

Faithful, useful, concise, tone, 1–5 each against the candidate's facts. Release bar: mean ≥ 4.0 per dimension, no single score < 3. One run per case is judged to bound cost.

## Dataset (`cases.ts`, `world.ts`)

11 cases / 41 candidates: indoor, outdoor good weather, estimated price, price = limit with attendance = 55%, everyone matched, unicode member name, no forecast, category penalty, **prompt injection in a venue name**, two slots of one activity, a 24-candidate full run. The world is self-contained, independent of `data/*.json`.

## Release thresholds (live)

Hard-grader pass rate 100% over all runs · fallback rate ≤10% (explanations identical to the template mean Claude silently failed) · judge bars above.

## Prerequisites / decisions for stream B

1. **Signature.** The contract says `explain(candidates)`, but a `Candidate` has no activity name, price or member names, which both the template and the prompt need. The eval assumes `explain(candidates, ctx?: { activities, members })` with `ctx` defaulting to the catalog and DB. Needs a contract PR. If B chooses another injection style, change only `adapter.ts`.
2. **Tool shape.** Offline mocks assume one forced tool whose input is `{ explanations: [{ id, explanation }] }`. Adjust `toolReply` in `explain.offline.test.ts` if B names it differently.
3. **Runtime validator (recommended, one `it.todo`).** The imp_plan validates only schema. Running H3/H4/H5/H9 in production and templating any failing id closes the hallucination gap; `graders.ts` is reusable for that.

## Extending

Add a case to `CASES` (and a world activity if needed). When a live failure appears, copy the failing candidate into `cases.ts` as a regression case before fixing the prompt.
