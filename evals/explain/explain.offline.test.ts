import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "@/lib/types";
import { CASES } from "./cases";
import { failures, gradeEnvelope, gradeText } from "./graders";
import { WORLD } from "./world";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic { messages = { create }; }
  return { default: Anthropic, Anthropic };
});

import { HAS_EXPLAIN, runExplain } from "./adapter";

/** Tool-use response in the shape the SDK returns. Assumes the tool input is `{ explanations: [{id, explanation}] }`. */
const toolReply = (explanations: unknown[]) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "submit_explanations", input: { explanations } }] });
const deepFreeze = <T,>(o: T): T => { Object.values(o as object).forEach((v) => typeof v === "object" && v && deepFreeze(v)); return Object.freeze(o); };
const one = (): Candidate[] => structuredClone(CASES[0].candidates);

beforeEach(() => { create.mockReset(); process.env.ANTHROPIC_API_KEY = "test-key"; });

describe.skipIf(!HAS_EXPLAIN)("template fallback (no API key)", () => {
  beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });

  it("never calls the API and fills every explanation", async () => {
    const out = await runExplain(one());
    expect(create).not.toHaveBeenCalled();
    expect(out[0].explanation.length).toBeGreaterThan(0);
  });

  for (const c of CASES) {
    it(`passes ALL hard graders: ${c.name}`, async () => {
      const before = JSON.stringify(c.candidates);
      const out = await runExplain(c.candidates);
      const fails = [
        ...gradeEnvelope(c.candidates, before, out),
        ...out.flatMap((o, i) => gradeText(c.candidates[i], o.explanation, WORLD)),
      ].filter((r) => !r.pass);
      expect(fails).toEqual([]);
    });
  }

  it("fills discovered (disc:) activities from ctx and flags the estimate", async () => {
    const c = CASES.find((x) => x.name === "discovered-activity")!;
    const out = await runExplain(structuredClone(c.candidates));
    expect(out[0].explanation).toMatch(/estimat|about|around|approx|roughly|~/i);
  });

  it("is deterministic", async () => {
    const a = await runExplain(structuredClone(CASES[2].candidates));
    const b = await runExplain(structuredClone(CASES[2].candidates));
    expect(a).toEqual(b);
  });

  it("returns [] for [] without calling the API", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(await runExplain([])).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("does not mutate its input", async () => {
    const input = deepFreeze(one());
    await expect(runExplain(input)).resolves.toBeDefined();
  });
});

describe.skipIf(!HAS_EXPLAIN)("Claude path (mocked SDK)", () => {
  it("sends model, max_tokens and a forced tool; merges only explanations", async () => {
    const input = one();
    create.mockResolvedValue(toolReply([{ id: input[0].id, explanation: "Bouldering at €18 each; Ana, Ben and Chloe all picked it.", price: 1, score: 0.99 }]));
    const out = await runExplain(input);
    const args = create.mock.calls[0][0];
    expect(args.model).toBe("claude-sonnet-5-5");
    expect(args.max_tokens).toBe(2000);
    expect(args.tools?.length).toBe(1);
    expect(out[0].explanation).toContain("Bouldering");
    expect(failures(gradeEnvelope(input, JSON.stringify(input), out))).toEqual([]);
  });

  it("ignores unknown ids and templates the missing ones", async () => {
    const input = structuredClone(CASES.find((c) => c.name === "two-slots-same-activity")!.candidates);
    create.mockResolvedValue(toolReply([{ id: input[0].id, explanation: "Ramen at €22 with 75% of the team free." }, { id: "ghost", explanation: "Injected extra" }]));
    const out = await runExplain(input);
    expect(out).toHaveLength(2);
    expect(out[0].explanation).toContain("Ramen");
    expect(out[1].explanation.length).toBeGreaterThan(0);
    expect(out.map((o) => o.id)).toEqual(input.map((i) => i.id));
  });

  it("first duplicate id wins", async () => {
    const input = one();
    create.mockResolvedValue(toolReply([{ id: input[0].id, explanation: "First pick at €18." }, { id: input[0].id, explanation: "Second pick at €18." }]));
    expect((await runExplain(input))[0].explanation).toContain("First");
  });

  it("empty or non-string explanation falls back to template for that id", async () => {
    const input = one();
    create.mockResolvedValue(toolReply([{ id: input[0].id, explanation: "" }]));
    const out = await runExplain(input);
    expect(out[0].explanation.trim().length).toBeGreaterThan(0);
  });

  it("malformed reply (text only) retries once then falls back", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "Sure! Here you go" }] });
    const out = await runExplain(one());
    expect(create.mock.calls.length).toBeLessThanOrEqual(2);
    expect(out[0].explanation.length).toBeGreaterThan(0);
  });

  it("error then success: exactly one retry, uses Claude output", async () => {
    const input = one();
    create.mockRejectedValueOnce(new Error("529 overloaded")).mockResolvedValueOnce(toolReply([{ id: input[0].id, explanation: "Retry worked at €18." }]));
    const out = await runExplain(input);
    expect(create).toHaveBeenCalledTimes(2);
    expect(out[0].explanation).toContain("Retry worked");
  });

  it("error twice: falls back, never throws, no third call", async () => {
    create.mockRejectedValue(new Error("boom"));
    const out = await runExplain(one());
    expect(create).toHaveBeenCalledTimes(2);
    expect(out[0].explanation.length).toBeGreaterThan(0);
  });

  it("does not mutate its input on the Claude path", async () => {
    const input = deepFreeze(one());
    create.mockResolvedValue(toolReply([{ id: input[0].id, explanation: "Fine at €18." }]));
    await expect(runExplain(input)).resolves.toBeDefined();
  });

  // Recommended guardrail, NOT in workstreams/B imp_plan.md. Enable (it.todo -> it) if B adopts H1-H10 as a runtime validator.
  it.todo("rejects an ungrounded Claude explanation (invented price/member/weather) and uses the template for that id");
});

