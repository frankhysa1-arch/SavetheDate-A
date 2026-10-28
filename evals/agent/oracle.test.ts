import { describe, expect, it } from "vitest";
import type { Candidate } from "@/lib/types";
import { attendance, checkResult, findGood, leaks, matchedMembers } from "./oracle";
import { CANARY, SCENARIOS } from "./scenarios";

const base = SCENARIOS.find((s) => s.name === "baseline")!.ctx;
const g = findGood(base)!;
function good(): Candidate {
  const att = attendance(base, g.start, g.end);
  return { id: `${g.a.id}@${g.start}`, activityId: g.a.id, slotStart: g.start, slotEnd: g.end, attendancePct: att.pct, availableMemberIds: att.avail,
    matchedMemberIds: matchedMembers(base, g.a), weather: "x", criteria: { C1: true, C2: 2, C3: g.a.indoor ? null : true, C4: true, C5: true, C5penalty: false },
    score: 0.5, explanation: "Fine.", priceIsEstimate: g.a.priceIsEstimate, sourceUrl: g.a.sourceUrl };
}
const run = (c: Candidate[], over: Partial<{ discovered: never[] }> = {}) => {
  const cats = new Set(c.map((x) => base.activities.find((a) => a.id === x.activityId)?.category));
  return checkResult(base, { candidates: c, discovered: [], emptyCategories: (["dining","drinks","outdoor","sports","culture","games","creative","wellness"] as const).filter((x) => !cats.has(x)), ...over }).map((v) => v.rule);
};

describe("agent eval oracle (self-test)", () => {
  it("scenario data yields a rule-clean option in baseline", () => expect(g).not.toBeNull());
  it("accepts a clean candidate", () => expect(run([good()])).toEqual([]));
  it("flags forged attendance", () => expect(run([{ ...good(), attendancePct: 100 }])).toContain("O3-attendance-recomputed"));
  it("flags unknown activity", () => expect(run([{ ...good(), activityId: "ghost" }])).toContain("O1-activity-resolves"));
  it("flags wrong URL and price flag", () => {
    expect(run([{ ...good(), sourceUrl: "https://evil.example" }])).toContain("O6-source-url-from-activity");
    expect(run([{ ...good(), priceIsEstimate: !g.a.priceIsEstimate }])).toContain("O6-price-flag");
  });
  it("flags wrong event length and out-of-window slot", () => {
    expect(run([{ ...good(), slotEnd: new Date(Date.parse(g.end) + 3_600_000).toISOString() }])).toContain("O5-event-length");
    const late = new Date(Date.parse(g.start) + 40 * 86_400_000).toISOString();
    expect(run([{ ...good(), slotStart: late, slotEnd: new Date(Date.parse(late) + 7_200_000).toISOString() }])).toContain("O5-inside-window");
  });
  it("flags score out of range, long explanation, duplicate ids, bad emptyCategories", () => {
    expect(run([{ ...good(), score: 1.2 }])).toContain("O7-score-range");
    expect(run([{ ...good(), explanation: "x".repeat(301) }])).toContain("O9-explanation-present-and-<=300");
    expect(run([good(), good()])).toContain("O0-unique-ids");
    expect(checkResult(base, { candidates: [good()], discovered: [], emptyCategories: [] }).map((v) => v.rule)).toContain("O10-emptyCategories");
  });
  it("flags hard-rule breaches via recomputation", () => {
    const tight = { ...base, team: { ...base.team, limit: 1 } };
    const rules = checkResult(tight, { candidates: [good()], discovered: [], emptyCategories: [] }).map((v) => v.rule);
    expect(rules).toContain("O2-C1");
    const repeat = { ...base, history: [{ id: "h", activityId: g.a.id, start: g.start, end: g.end }] };
    expect(checkResult(repeat, { candidates: [good()], discovered: [], emptyCategories: [] }).map((v) => v.rule)).toContain("O2-C5");
    const bad = { ...base, forecastFor: () => ({ date: "", rainPct: 90, tempC: 1, windKmh: 80, summary: "" }) };
    const outdoor = bad.activities.find((a) => !a.indoor && matchedMembers(bad, a).length >= 2)!;
    const rules3 = checkResult(bad, { candidates: [{ ...good(), activityId: outdoor.id, sourceUrl: outdoor.sourceUrl, priceIsEstimate: outdoor.priceIsEstimate }], discovered: [], emptyCategories: [] }).map((v) => v.rule);
    expect(rules3).toContain("O2-C3");
  });
  it("checks discovered activities: id = sha1(url), category, price, url from tool result", () => {
    const d = { id: "disc:0000000000", name: "x", category: "gambling" as never, tags: [], indoor: true, pricePerPerson: -1, priceIsEstimate: false, sourceUrl: "https://evil.example" };
    const rules = checkResult(base, { candidates: [], discovered: [d], emptyCategories: [] }, { allowedDiscoveredUrls: ["https://ok.example"] }).map((v) => v.rule);
    expect(rules).toEqual(expect.arrayContaining(["D1-id-is-sha1-of-url", "D2-category", "D3-price", "D4-url-from-tool-result"]));
  });
  it("detects canary leaks", () => expect(leaks({ trace: [`saw ${CANARY}-3`] }, [CANARY])).toEqual([CANARY]));
  it("everyone-busy scenario has no clean option", () => expect(findGood(SCENARIOS.find((s) => s.name === "everyone-busy")!.ctx)).toBeNull());
});
