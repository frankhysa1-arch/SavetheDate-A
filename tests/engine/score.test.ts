import { describe, expect, it } from "vitest";
import { computeScore, priceScore, ratingAffinity } from "@/lib/engine/score";
import { makeActivity, makePastEvent } from "./fixtures";

describe("computeScore", () => {
  it("matches a hand-computed fixture to 4 decimals", () => {
    // 0.35*0.5 + 0.20*0.5 + 0.20*0.625 + 0.15*1 + 0.10*0.75 = 0.625
    expect(computeScore({ P: 0.5, R: 0.5, A: 0.625, N: 1, B: 0.75 })).toBeCloseTo(0.625, 4);
  });
  it("never exceeds 1 or drops below 0", () => {
    expect(computeScore({ P: 1, R: 1, A: 1, N: 1, B: 1 })).toBeLessThanOrEqual(1);
    expect(computeScore({ P: 0, R: 0, A: 0, N: 0, B: 0 })).toBe(0);
  });
});

describe("priceScore", () => {
  it("is 1 for free, 0 at the limit, clamped above it", () => {
    expect(priceScore(0, 40)).toBe(1);
    expect(priceScore(40, 40)).toBe(0);
    expect(priceScore(80, 40)).toBe(0);
    expect(priceScore(10, 40)).toBeCloseTo(0.75, 4);
  });
  it("guards a zero limit", () => {
    expect(priceScore(0, 0)).toBe(1);
    expect(priceScore(5, 0)).toBe(0);
  });
});

describe("ratingAffinity", () => {
  const dining = makeActivity({ id: "d1", category: "dining" });
  const games = makeActivity({ id: "g1", category: "games" });
  const resolve = (id: string) => [dining, games].find((a) => a.id === id);
  const history = [
    makePastEvent({ id: "e1", activityId: "d1" }),
    makePastEvent({ id: "e2", activityId: "g1" }),
  ];

  it("defaults to 0.5 when the category has no ratings", () => {
    expect(ratingAffinity("dining", [], history, resolve)).toBe(0.5);
  });
  it("normalises 1..5 to 0..1 and averages within the category only", () => {
    const ratings = [
      { id: "r1", eventId: "e1", memberId: "m0", score: 5 as const },
      { id: "r2", eventId: "e1", memberId: "m1", score: 3 as const },
      { id: "r3", eventId: "e2", memberId: "m0", score: 1 as const },
    ];
    expect(ratingAffinity("dining", ratings, history, resolve)).toBeCloseTo(0.75, 4);
    expect(ratingAffinity("games", ratings, history, resolve)).toBe(0);
  });
  it("ignores ratings whose event activity cannot be resolved", () => {
    const ratings = [{ id: "r1", eventId: "e1", memberId: "m0", score: 5 as const }];
    expect(ratingAffinity("dining", ratings, history, () => undefined)).toBe(0.5);
  });
});
