import { describe, expect, it } from "vitest";
import { CATEGORIES, CandidateSchema, type AgentResult, type Candidate, type Run } from "@/lib/types";

const valid: Candidate = {
  id: "cand-1",
  activityId: "act-bowling",
  slotStart: "2026-11-05T18:00:00.000Z",
  slotEnd: "2026-11-05T20:00:00.000Z",
  attendancePct: 80,
  availableMemberIds: ["m1", "m2", "m3", "m4"],
  matchedMemberIds: ["m1", "m2"],
  weather: "",
  criteria: { C1: true, C2: 0.5, C3: null, C4: true, C5: true, C5penalty: false },
  score: 0.72,
  explanation: "",
  priceIsEstimate: false,
  sourceUrl: "https://example.com/bowling",
};

describe("lib/types", () => {
  it("has the 8 MVP categories", () => {
    expect(CATEGORIES).toHaveLength(8);
  });

  it("CandidateSchema accepts a valid candidate", () => {
    expect(CandidateSchema.parse(valid)).toEqual(valid);
  });

  it("CandidateSchema rejects an invalid candidate", () => {
    const missingField = { ...valid } as Partial<Candidate>;
    delete missingField.sourceUrl;
    expect(CandidateSchema.safeParse(missingField).success).toBe(false);

    const badCriteria = { ...valid, criteria: { ...valid.criteria, C3: "yes" } };
    expect(CandidateSchema.safeParse(badCriteria).success).toBe(false);

    expect(CandidateSchema.safeParse({ ...valid, score: 1.5 }).success).toBe(false);
  });

  it("Run and AgentResult carry discovered activities", () => {
    const run: Run = { id: "r1", createdAt: "2026-11-01T00:00:00.000Z", candidates: [valid], emptyCategories: [], discovered: [] };
    const result: AgentResult = {
      candidates: [valid], emptyCategories: [], discovered: [],
      mode: "fallback", trace: [], usage: { toolCalls: 0, inputTokens: 0, outputTokens: 0 }, gaps: [],
    };
    expect(run.discovered).toEqual(result.discovered);
  });
});
