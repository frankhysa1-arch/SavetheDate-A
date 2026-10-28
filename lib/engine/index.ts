// Deterministic planner: rules C1 to C5, slots, scoring, per-category shortlist.
// Pure: no HTTP, DB or model calls. Also the fallback for the planning agent.
import { CATEGORIES } from "@/lib/types";
import type { Activity, Candidate, Category, Forecast, PlanContext, PlanResult, Slot } from "@/lib/types";
import { c1Price, c2Preference, c3Weather, c4Attendance, c5Novelty } from "./rules";
import { computeScore, priceScore, ratingAffinity } from "./score";
import { findSlots } from "./slots";
import { localDateKey } from "./time";

export const SHORTLIST_PER_CATEGORY = 2;

export function weatherText(forecast: Forecast | null): string {
  if (!forecast) return "No forecast available";
  return `${forecast.summary}, ${forecast.rainPct}% rain, ${forecast.tempC}°C, ${forecast.windKmh} km/h wind`;
}

/** Candidate ranking inside a category: score, then attendance, then price, then id. */
function compareInCategory(price: (c: Candidate) => number) {
  return (a: Candidate, b: Candidate) =>
    b.score - a.score || b.attendancePct - a.attendancePct || price(a) - price(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function planCandidates(ctx: PlanContext): PlanResult {
  const { team, members, activities, history, ratings, busy } = ctx;
  const byId = new Map(activities.map((a) => [a.id, a]));
  const resolve = (id: string) => byId.get(id);
  const slots = findSlots(team, members, busy, ctx.now);

  const bestPerActivity: Candidate[] = [];
  for (const activity of activities) {
    // C1 and the C2 floor do not depend on the slot, so check them once.
    if (!c1Price(activity, team)) continue;
    const c2 = c2Preference(activity, members);
    if (!c2.pass) continue;

    let best: Candidate | undefined;
    for (const slot of slots) {
      const candidate = buildCandidate(ctx, activity, slot, c2.matched, resolve);
      if (!candidate) continue;
      if (!best || compareSlots(candidate, best) < 0) best = candidate;
    }
    if (best) bestPerActivity.push(best);
  }

  const price = (c: Candidate) => byId.get(c.activityId)?.pricePerPerson ?? Infinity;
  const candidates: Candidate[] = [];
  const emptyCategories: Category[] = [];
  for (const category of CATEGORIES) {
    const inCategory = bestPerActivity
      .filter((c) => byId.get(c.activityId)?.category === category)
      .sort(compareInCategory(price))
      .slice(0, SHORTLIST_PER_CATEGORY);
    if (inCategory.length === 0) emptyCategories.push(category);
    candidates.push(...inCategory);
  }
  return { candidates, emptyCategories, discovered: [] };
}

/** Same activity across slots: higher score, then attendance, then earlier start. */
function compareSlots(a: Candidate, b: Candidate): number {
  return b.score - a.score || b.attendancePct - a.attendancePct || Date.parse(a.slotStart) - Date.parse(b.slotStart);
}

function buildCandidate(
  ctx: PlanContext,
  activity: Activity,
  slot: Slot,
  matched: string[],
  resolve: (id: string) => Activity | undefined,
): Candidate | undefined {
  const { team, members, history, ratings } = ctx;
  if (!c4Attendance(slot, team)) return undefined;

  const forecast = ctx.forecastFor(localDateKey(Date.parse(slot.start)));
  const c3 = c3Weather(activity, forecast);
  if (c3 === false) return undefined;

  const c5 = c5Novelty(activity, history, team, slot.start, resolve);
  if (!c5.pass) return undefined;

  const score = computeScore({
    P: matched.length / members.length,
    R: ratingAffinity(activity.category, ratings, history, resolve),
    A: slot.attendancePct / 100,
    N: c5.penalty ? 0 : 1,
    B: priceScore(activity.pricePerPerson, team.limit),
  });

  return {
    id: `${activity.id}@${slot.start}`,
    activityId: activity.id,
    slotStart: slot.start,
    slotEnd: slot.end,
    attendancePct: slot.attendancePct,
    availableMemberIds: slot.availableMemberIds,
    matchedMemberIds: matched,
    weather: weatherText(forecast),
    criteria: { C1: true, C2: matched.length, C3: c3, C4: true, C5: true, C5penalty: c5.penalty },
    score,
    explanation: "",
    priceIsEstimate: activity.priceIsEstimate,
    sourceUrl: activity.sourceUrl,
  };
}
