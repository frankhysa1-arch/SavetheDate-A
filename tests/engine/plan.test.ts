import { describe, expect, it } from "vitest";
import { planCandidates } from "@/lib/engine";
import { c1Price, c3Weather, c4Attendance, c5Novelty } from "@/lib/engine/rules";
import { CATEGORIES, CandidateSchema } from "@/lib/types";
import type { Activity, BusyMap, Category, Forecast, PlanContext } from "@/lib/types";
import { GOOD_WEATHER, NOW, makeActivity, makeContext, makeMembers, makePastEvent, makeTeam } from "./fixtures";

const act = (id: string, category: Category, over: Partial<Activity> = {}) =>
  makeActivity({ id, category, name: id, ...over });

describe("planCandidates shortlist", () => {
  it("keeps at most 2 per category and reports empty categories", () => {
    const ctx = makeContext({
      activities: [
        act("d1", "dining", { pricePerPerson: 10 }), act("d2", "dining", { pricePerPerson: 20 }),
        act("d3", "dining", { pricePerPerson: 30 }), act("g1", "games"),
      ],
    });
    const r = planCandidates(ctx);
    const byCat = (c: Category) => r.candidates.filter((x) => ctx.activities.find((a) => a.id === x.activityId)?.category === c);
    expect(byCat("dining")).toHaveLength(2);
    expect(byCat("games")).toHaveLength(1);
    expect(r.emptyCategories).toEqual(CATEGORIES.filter((c) => c !== "dining" && c !== "games"));
    expect(r.discovered).toEqual([]);
  });

  it("fills the two spots with distinct activities, not one activity at two slots", () => {
    const ctx = makeContext({ activities: [act("d1", "dining"), act("d2", "dining")] });
    const ids = planCandidates(ctx).candidates.map((c) => c.activityId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(["d1", "d2"]);
  });

  it("drops activities that fail C1, the C2 floor, C3, C5", () => {
    const ctx = makeContext({
      members: makeMembers(8, (i) => (i < 1 ? { categories: ["culture"] } : { categories: ["dining", "games", "outdoor"] })),
      activities: [
        act("over", "dining", { pricePerPerson: 41 }),
        act("lonely", "culture"), // only one member likes culture
        act("rainy", "outdoor", { indoor: false }),
        act("repeat", "games"),
        act("ok", "dining"),
      ],
      forecastFor: (date): Forecast => ({ ...GOOD_WEATHER, date, rainPct: 90 }),
      history: [makePastEvent({ activityId: "repeat", start: "2026-10-20T18:00:00-07:00" })],
    });
    expect(planCandidates(ctx).candidates.map((c) => c.activityId)).toEqual(["ok"]);
  });

  it("outdoor with no forecast is kept with C3 null and a no-forecast weather string", () => {
    const ctx = makeContext({ activities: [act("hike", "outdoor", { indoor: false })], forecastFor: () => null });
    const [c] = planCandidates(ctx).candidates;
    expect(c.criteria.C3).toBeNull();
    expect(c.weather).toBe("No forecast available");
  });

  it("applies the category penalty to score but keeps the option", () => {
    const history = [makePastEvent({ id: "e1", activityId: "past", start: "2026-10-27T18:00:00-07:00" })];
    const past = act("past", "dining");
    const base = makeContext({ activities: [past, act("d1", "dining"), act("g1", "games")], history });
    const r = planCandidates(base);
    const d1 = r.candidates.find((c) => c.activityId === "d1");
    const g1 = r.candidates.find((c) => c.activityId === "g1");
    expect(d1?.criteria.C5penalty).toBe(true);
    expect(g1?.criteria.C5penalty).toBe(false);
    // Identical price, preferences and attendance: the penalty is the only difference (0.15).
    expect((g1?.score ?? 0) - (d1?.score ?? 0)).toBeCloseTo(0.15, 4);
  });

  it("fills the Candidate shape with deterministic ids and an empty explanation", () => {
    const ctx = makeContext({ activities: [act("d1", "dining", { pricePerPerson: 10 })] });
    const [c] = planCandidates(ctx).candidates;
    expect(c.id).toBe(`d1@${c.slotStart}`);
    expect(c.explanation).toBe("");
    expect(c.criteria).toMatchObject({ C1: true, C2: 8, C4: true, C5: true });
    expect(c.matchedMemberIds).toHaveLength(8);
    expect(CandidateSchema.safeParse(c).success).toBe(true);
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(1);
  });

  it("returns nothing when no slot clears the attendance threshold", () => {
    const ctx = makeContext({
      activities: [act("d1", "dining")],
      busy: Object.fromEntries(
        makeMembers(8).map((m) => [m.id, [{ start: "2026-10-27T00:00:00-07:00", end: "2026-12-01T00:00:00-08:00" }]]),
      ) as BusyMap,
    });
    const r = planCandidates(ctx);
    expect(r.candidates).toEqual([]);
    expect(r.emptyCategories).toEqual([...CATEGORIES]);
  });
});

describe("determinism", () => {
  it("same context gives identical output", () => {
    const ctx = makeContext({
      activities: [act("d1", "dining"), act("d2", "dining"), act("g1", "games"), act("s1", "sports")],
    });
    expect(planCandidates(ctx)).toEqual(planCandidates(ctx));
  });
});

// Seeded PRNG so the property test is reproducible without a new dependency.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("property: no output candidate violates a hard rule", () => {
  it("holds across 200 random contexts", () => {
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = mulberry32(seed);
      const int = (n: number) => Math.floor(rnd() * n);
      const nMembers = 4 + int(17);
      const team = makeTeam({ limit: 10 + int(60), attendanceThresholdPct: 30 + int(60), noveltyWeeks: 1 + int(8) });
      const members = makeMembers(nMembers, () => ({
        categories: CATEGORIES.filter(() => rnd() < 0.4),
        tags: [],
      }));
      const activities: Activity[] = Array.from({ length: 30 }, (_, i) =>
        act(`x${i}`, CATEGORIES[int(8)], { pricePerPerson: int(90), indoor: rnd() < 0.5 }),
      );
      const history = Array.from({ length: int(4) }, (_, i) =>
        makePastEvent({
          id: `h${i}`, activityId: `x${int(30)}`,
          start: new Date(Date.parse(NOW) - int(80) * 86400000).toISOString(),
        }),
      );
      const busy: BusyMap = {};
      for (const m of members) {
        busy[m.id] = Array.from({ length: int(6) }, () => {
          const s = Date.parse(NOW) + int(14 * 24) * 3600000;
          return { start: new Date(s).toISOString(), end: new Date(s + (1 + int(5)) * 3600000).toISOString() };
        });
      }
      const forecastFor = (date: string): Forecast | null => {
        const h = [...date].reduce((x, ch) => (x * 31 + ch.charCodeAt(0)) >>> 0, seed);
        if (h % 7 === 0) return null;
        return { date, rainPct: h % 100, tempC: (h >>> 3) % 40, windKmh: (h >>> 5) % 50, summary: "x" };
      };
      const ctx: PlanContext = { team, members, activities, history, ratings: [], busy, forecastFor, now: NOW };
      const result = planCandidates(ctx);
      const byId = new Map(activities.map((a) => [a.id, a]));

      total += result.candidates.length;
      const perCategory = new Map<string, number>();
      for (const c of result.candidates) {
        const a = byId.get(c.activityId)!;
        perCategory.set(a.category, (perCategory.get(a.category) ?? 0) + 1);
        expect(c1Price(a, team)).toBe(true);
        expect(c4Attendance({ attendancePct: c.attendancePct }, team)).toBe(true);
        expect(c3Weather(a, forecastFor(c.slotStart.slice(0, 10)))).not.toBe(false);
        expect(c5Novelty(a, history, team, c.slotStart, (id) => byId.get(id)).pass).toBe(true);
        expect(c.matchedMemberIds.length).toBeGreaterThanOrEqual(2);
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(1);
      }
      for (const n of perCategory.values()) expect(n).toBeLessThanOrEqual(2);
    }
    // Guard against a vacuous pass: the generator must actually produce candidates.
    expect(total).toBeGreaterThan(500);
  });
});
