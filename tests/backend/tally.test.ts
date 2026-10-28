import { describe, expect, it } from "vitest";
import { tallyVotes } from "@/lib/tally";
import { candidate } from "./helpers";

const prices: Record<string, number> = { cheap: 10, mid: 20, dear: 30 };
const priceOf = (id: string) => prices[id];

const A = candidate("A", { activityId: "mid", attendancePct: 80 });
const B = candidate("B", { activityId: "mid", attendancePct: 80 });
const C = candidate("C", { activityId: "mid", attendancePct: 80 });

const ballot = (memberId: string, ...ids: string[]) =>
  ids.map((candidateId, i) => ({ memberId, candidateId, rank: i + 1 }));

describe("tallyVotes", () => {
  it("awards 3/2/1 points and counts first choices", () => {
    const votes = [...ballot("m1", "A", "B", "C"), ...ballot("m2", "A", "C", "B"), ...ballot("m3", "B", "A", "C")];
    const { rows, ballotsCast } = tallyVotes(votes, [A, B, C], priceOf);
    expect(ballotsCast).toBe(3);
    expect(rows).toEqual([
      { candidateId: "A", points: 8, firstChoiceVotes: 2 },
      { candidateId: "B", points: 6, firstChoiceVotes: 1 },
      { candidateId: "C", points: 4, firstChoiceVotes: 0 },
    ]);
  });

  it("breaks a points tie by higher attendance", () => {
    const hi = candidate("hi", { attendancePct: 90 });
    const lo = candidate("lo", { attendancePct: 60 });
    const { rows } = tallyVotes([...ballot("m1", "lo", "hi"), ...ballot("m2", "hi", "lo")], [lo, hi], priceOf);
    expect(rows.map((r) => r.candidateId)).toEqual(["hi", "lo"]);
  });

  it("breaks an attendance tie by lower price", () => {
    const dear = candidate("dear", { activityId: "dear" });
    const cheap = candidate("cheap", { activityId: "cheap" });
    const { rows } = tallyVotes([...ballot("m1", "dear", "cheap"), ...ballot("m2", "cheap", "dear")], [dear, cheap], priceOf);
    expect(rows.map((r) => r.candidateId)).toEqual(["cheap", "dear"]);
  });

  it("lists unvoted candidates with zero points and handles partial ballots", () => {
    // Candidate B was removed after m1 voted, leaving ranks 1 and 3 only.
    const votes = [
      { memberId: "m1", candidateId: "A", rank: 1 },
      { memberId: "m1", candidateId: "C", rank: 3 },
    ];
    const { rows, ballotsCast } = tallyVotes(votes, [A, C, candidate("D")], priceOf);
    expect(ballotsCast).toBe(1);
    expect(rows.map((r) => [r.candidateId, r.points])).toEqual([["A", 3], ["C", 1], ["D", 0]]);
  });

  it("ignores votes for candidates that are not in the run and reports no ballots when empty", () => {
    const stray = tallyVotes(ballot("m1", "ghost", "A", "B"), [A, B], priceOf);
    expect(stray.rows.find((r) => r.candidateId === "A")?.points).toBe(2);
    expect(stray.rows.some((r) => r.candidateId === "ghost")).toBe(false);
    expect(tallyVotes([], [A], priceOf)).toEqual({
      rows: [{ candidateId: "A", points: 0, firstChoiceVotes: 0 }],
      ballotsCast: 0,
    });
  });
});
