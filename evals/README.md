# Evals

| Suite | System under test | Owner stream | Why |
| --- | --- | --- | --- |
| `agent/` | `runPlanningAgent` (the planning agent, CONTRACT v2) | A | The agent proposes options; code must guarantee C1, C3, C4, C5, privacy and budget no matter what the model does |
| `explain/` | `explain()` (template + Claude fallback) | B | Since v2 it runs only when `mode === "fallback"` or an explanation is still `""` |

`npm test` runs the offline tiers. Suites skip (with a visible "skipped") until the module under test exists, so a stream that has not landed never turns `npm test` red.
Live tiers need `EVAL_LIVE=1` and `ANTHROPIC_API_KEY` exported in the shell (Vitest does not read `.env`).
