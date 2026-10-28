// Hand-built fixtures for engine tests. Never read data/*.json: tests must not
// change when the catalog is regenerated. (Not named *.test.ts so vitest skips it.)
import type { Activity, BusyMap, Forecast, Member, PastEvent, PlanContext, Team } from "@/lib/types";

// Wednesday 2026-10-28 09:00 PDT.
export const NOW = "2026-10-28T09:00:00-07:00";

export function makeTeam(over: Partial<Team> = {}): Team {
  return {
    limit: 40, currency: "EUR", windowDays: 14, eventLengthMin: 120,
    attendanceThresholdPct: 55, noveltyWeeks: 6, city: "San Francisco",
    timeWindows: [
      { days: [1, 2, 3, 4, 5], start: "17:30", end: "20:00" },
      { days: [6], start: "12:00", end: "16:00" },
    ],
    ...over,
  };
}

export function makeMembers(n: number, over: (i: number) => Partial<Member> = () => ({})): Member[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`, name: `Member ${i}`, categories: [], tags: [], constraints: {}, ...over(i),
  }));
}

export function makeActivity(over: Partial<Activity> = {}): Activity {
  return {
    id: "a1", name: "Activity", category: "dining", tags: [], indoor: true,
    pricePerPerson: 20, priceIsEstimate: false, sourceUrl: "https://example.com/a1", ...over,
  };
}

export const GOOD_WEATHER: Forecast = { date: "", rainPct: 10, tempC: 18, windKmh: 10, summary: "Sunny" };

export const weather = (over: Partial<Forecast> = {}): Forecast => ({ ...GOOD_WEATHER, ...over });

export function makePastEvent(over: Partial<PastEvent> = {}): PastEvent {
  return { id: "e1", activityId: "a1", start: "2026-10-01T18:00:00-07:00", end: "2026-10-01T20:00:00-07:00", ...over };
}

/** 8 members who all like every category, all free, good weather every day. */
export function makeContext(over: Partial<PlanContext> = {}): PlanContext {
  return {
    team: makeTeam(),
    members: makeMembers(8, () => ({ categories: ["dining", "drinks", "outdoor", "sports", "culture", "games", "creative", "wellness"] })),
    activities: [],
    history: [],
    ratings: [],
    busy: {} as BusyMap,
    forecastFor: (date) => ({ ...GOOD_WEATHER, date }),
    now: NOW,
    ...over,
  };
}
