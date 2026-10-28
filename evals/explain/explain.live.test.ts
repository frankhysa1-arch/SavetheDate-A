/**
 * Live eval against the real Claude API. Skipped unless EVAL_LIVE=1 and ANTHROPIC_API_KEY are set.
 *   EVAL_LIVE=1 [EVAL_RUNS=3] [EVAL_JUDGE=1] npx vitest run evals/explain/explain.live.test.ts
 * Writes evals/explain/results/<timestamp>.json (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CASES } from "./cases";
import { failures, gradeEnvelope, gradeText, type GradeResult } from "./graders";
import { judge, type JudgeScores } from "./judge";
import { HAS_EXPLAIN, runExplain } from "./adapter";
import { WORLD } from "./world";

const LIVE = process.env.EVAL_LIVE === "1" && !!process.env.ANTHROPIC_API_KEY && HAS_EXPLAIN;
const RUNS = Number(process.env.EVAL_RUNS ?? 3);
const JUDGE = process.env.EVAL_JUDGE === "1";

// Release thresholds
const HARD_PASS_RATE = 1.0;   // every grader on every run
const MAX_FALLBACK_RATE = 0.1; // share of explanations identical to the template (silent degradation)
const MIN_JUDGE_MEAN = 4.0;
const MIN_JUDGE_FLOOR = 3;

describe.skipIf(!LIVE)("explain: live Claude eval", () => {
  it("meets hard-grader, fallback-rate and quality thresholds", async () => {
    const rows: { case: string; run: number; id: string; text: string; hard: GradeResult[]; judge?: JudgeScores }[] = [];
    const template = new Map<string, string>();

    // Template baseline: temporarily drop the key so explain() takes the fallback path.
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    for (const c of CASES) (await runExplain(structuredClone(c.candidates))).forEach((o) => template.set(`${c.name}:${o.id}`, o.explanation));
    process.env.ANTHROPIC_API_KEY = key;

    let total = 0, same = 0;
    for (const c of CASES) {
      for (let run = 0; run < RUNS; run++) {
        const input = structuredClone(c.candidates);
        const before = JSON.stringify(input);
        const out = await runExplain(input);
        const env = gradeEnvelope(c.candidates, before, out);
        out.forEach((o, i) => {
          total++; if (o.explanation === template.get(`${c.name}:${o.id}`)) same++;
          rows.push({ case: c.name, run, id: o.id, text: o.explanation, hard: [...(i === 0 ? env : []), ...gradeText(c.candidates[i], o.explanation, WORLD)] });
        });
      }
    }

    if (JUDGE) {
      for (const r of rows.filter((x) => x.run === 0)) { // judge one run per case to bound cost
        const cand = CASES.find((c) => c.name === r.case)!.candidates.find((x) => x.id === r.id)!;
        r.judge = await judge(cand, r.text, WORLD);
      }
    }

    const hardChecks = rows.flatMap((r) => r.hard);
    const hardFails = rows.flatMap((r) => failures(r.hard).map((f) => ({ case: r.case, run: r.run, id: r.id, grader: f.id, detail: f.detail, text: r.text })));
    const passRate = 1 - hardFails.length / hardChecks.length;
    const fallbackRate = same / total;
    const judged = rows.filter((r) => r.judge);
    const dims = ["faithful", "useful", "concise", "tone"] as const;
    const judgeMeans = Object.fromEntries(dims.map((d) => [d, judged.reduce((s, r) => s + r.judge![d], 0) / (judged.length || 1)]));
    const judgeMin = judged.length ? Math.min(...judged.flatMap((r) => dims.map((d) => r.judge![d]))) : null;

    mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
    writeFileSync(new URL(`./results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url),
      JSON.stringify({ runs: RUNS, passRate, fallbackRate, judgeMeans, judgeMin, hardFails, rows }, null, 2));
    console.log({ passRate, fallbackRate, judgeMeans, judgeMin, hardFailCount: hardFails.length });

    expect(hardFails, JSON.stringify(hardFails.slice(0, 5), null, 2)).toEqual([]);
    expect(passRate).toBeGreaterThanOrEqual(HARD_PASS_RATE);
    expect(fallbackRate).toBeLessThanOrEqual(MAX_FALLBACK_RATE);
    if (JUDGE) {
      for (const d of dims) expect(judgeMeans[d], `judge mean ${d}`).toBeGreaterThanOrEqual(MIN_JUDGE_MEAN);
      expect(judgeMin).toBeGreaterThanOrEqual(MIN_JUDGE_FLOOR);
    }
  }, 30 * 60_000);
});
