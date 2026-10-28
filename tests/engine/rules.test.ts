import { describe, expect, it } from "vitest";
import { c1Price, c2Preference, c3Weather, c4Attendance, c5Novelty } from "@/lib/engine/rules";
import { makeActivity, makeMembers, makePastEvent, makeTeam, weather } from "./fixtures";

const team = makeTeam();

describe("C1 price", () => {
  it("passes when price equals the limit", () => {
    expect(c1Price(makeActivity({ pricePerPerson: 40 }), team)).toBe(true);
  });
  it("fails at limit plus 1", () => {
    expect(c1Price(makeActivity({ pricePerPerson: 41 }), team)).toBe(false);
  });
});

describe("C2 preference", () => {
  const act = makeActivity({ id: "bowling", category: "games" });
  it("one match fails the floor", () => {
    const members = makeMembers(4, (i) => (i === 0 ? { categories: ["games"] } : {}));
    expect(c2Preference(act, members)).toEqual({ matched: ["m0"], pass: false });
  });
  it("two matches pass the floor", () => {
    const members = makeMembers(4, (i) => (i < 2 ? { categories: ["games"] } : {}));
    expect(c2Preference(act, members).pass).toBe(true);
  });
  it("matches on activity id in tags as well as category", () => {
    const members = makeMembers(4, (i) => (i === 0 ? { categories: ["games"] } : i === 1 ? { tags: ["bowling"] } : {}));
    expect(c2Preference(act, members).matched).toEqual(["m0", "m1"]);
  });
  it("more matches yield a longer matched list", () => {
    const two = makeMembers(4, (i) => (i < 2 ? { categories: ["games"] } : {}));
    const three = makeMembers(4, (i) => (i < 3 ? { categories: ["games"] } : {}));
    expect(c2Preference(act, three).matched.length).toBeGreaterThan(c2Preference(act, two).matched.length);
  });
});

describe("C3 weather", () => {
  const outdoor = makeActivity({ indoor: false });
  it("rain 40 passes, 41 fails", () => {
    expect(c3Weather(outdoor, weather({ rainPct: 40 }))).toBe(true);
    expect(c3Weather(outdoor, weather({ rainPct: 41 }))).toBe(false);
  });
  it("temperature bounds are inclusive at 5 and 32, fail at 4 and 33", () => {
    expect(c3Weather(outdoor, weather({ tempC: 5 }))).toBe(true);
    expect(c3Weather(outdoor, weather({ tempC: 32 }))).toBe(true);
    expect(c3Weather(outdoor, weather({ tempC: 4 }))).toBe(false);
    expect(c3Weather(outdoor, weather({ tempC: 33 }))).toBe(false);
  });
  it("wind 30 passes, 31 fails", () => {
    expect(c3Weather(outdoor, weather({ windKmh: 30 }))).toBe(true);
    expect(c3Weather(outdoor, weather({ windKmh: 31 }))).toBe(false);
  });
  it("indoor passes in a storm", () => {
    expect(c3Weather(makeActivity({ indoor: true }), weather({ rainPct: 100, windKmh: 80, tempC: -5 }))).toBe(true);
  });
  it("null forecast is not a hard fail for outdoor", () => {
    expect(c3Weather(outdoor, null)).toBeNull();
  });
});

describe("C4 attendance", () => {
  it("exactly at the threshold passes", () => {
    expect(c4Attendance({ attendancePct: 55 }, team)).toBe(true);
  });
  it("just below fails", () => {
    expect(c4Attendance({ attendancePct: 50 }, team)).toBe(false);
  });
});

describe("C5 novelty", () => {
  const act = makeActivity({ id: "a1", category: "dining" });
  const other = makeActivity({ id: "a2", category: "games" });
  const resolve = (id: string) => [act, other].find((a) => a.id === id);
  const slotStart = "2026-11-05T17:30:00-08:00";

  it("same activity inside the window fails", () => {
    const history = [makePastEvent({ activityId: "a1", start: "2026-10-20T18:00:00-07:00" })];
    expect(c5Novelty(act, history, team, slotStart, resolve).pass).toBe(false);
  });
  it("same activity outside the window passes", () => {
    const history = [makePastEvent({ activityId: "a1", start: "2026-08-01T18:00:00-07:00" })];
    expect(c5Novelty(act, history, team, slotStart, resolve).pass).toBe(true);
  });
  it("exactly noveltyWeeks of elapsed time away is inside the window, one minute more is outside", () => {
    // Slot is 2026-11-06T01:30Z. 42 days earlier is 2026-09-25T01:30Z = 18:30 PDT on Sep 24.
    const exact = [makePastEvent({ activityId: "a1", start: "2026-09-24T18:30:00-07:00" })];
    expect(c5Novelty(act, exact, team, slotStart, resolve).pass).toBe(false);
    const older = [makePastEvent({ activityId: "a1", start: "2026-09-24T18:29:00-07:00" })];
    expect(c5Novelty(act, older, team, slotStart, resolve).pass).toBe(true);
  });
  it("same category as the last event sets the penalty but keeps the option", () => {
    const history = [makePastEvent({ activityId: "a1", start: "2026-06-01T18:00:00-07:00" })];
    const other2 = makeActivity({ id: "a3", category: "dining" });
    const r = c5Novelty(other2, history, team, slotStart, (id) => (id === "a1" ? act : undefined));
    expect(r).toEqual({ pass: true, penalty: true });
  });
  it("different category as the last event has no penalty", () => {
    const history = [makePastEvent({ activityId: "a1", start: "2026-10-30T18:00:00-07:00" })];
    expect(c5Novelty(other, history, team, slotStart, resolve)).toEqual({ pass: true, penalty: false });
  });
  it("no history means no penalty", () => {
    expect(c5Novelty(act, [], team, slotStart, resolve)).toEqual({ pass: true, penalty: false });
  });
});
