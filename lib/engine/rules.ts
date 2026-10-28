// Pure rule functions. Hard rules (C1, C3 outdoor, C4, C5 same activity) filter;
// scored rules (C2 count, C5 category penalty) only affect the score.
import type { Activity, Forecast, Member, PastEvent, Slot, Team } from "@/lib/types";

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** C1 hard: price per person within the limit (equal passes). */
export function c1Price(activity: Activity, team: Team): boolean {
  return activity.pricePerPerson <= team.limit;
}

/** C2 floor + scored: members who list the activity id (tags) or its category. */
export function c2Preference(
  activity: Activity, members: Member[],
): { matched: string[]; pass: boolean } {
  const matched = members
    .filter((m) => m.tags.includes(activity.id) || m.categories.includes(activity.category))
    .map((m) => m.id);
  return { matched, pass: matched.length >= 2 };
}

/**
 * C3 hard for outdoor: rain <= 40, 5 <= temp <= 32, wind <= 30.
 * Indoor always passes. No forecast returns null (never a hard fail, no score effect).
 */
export function c3Weather(activity: Activity, forecast: Forecast | null): boolean | null {
  if (activity.indoor) return true;
  if (forecast === null) return null;
  return forecast.rainPct <= 40 && forecast.tempC >= 5 && forecast.tempC <= 32 && forecast.windKmh <= 30;
}

/**
 * C4 hard: attendance at or above the threshold. `attendancePct` is computed as
 * available*100/total, which is exact when the true ratio is an integer percent.
 */
export function c4Attendance(slot: Pick<Slot, "attendancePct">, team: Team): boolean {
  return slot.attendancePct >= team.attendanceThresholdPct;
}

/**
 * C5: hard fail if the same activity happened within `noveltyWeeks` of the slot
 * (inclusive, either side). `penalty` is true when the most recent event before
 * the slot has the same category. `resolve` maps history activity ids to activities.
 */
export function c5Novelty(
  activity: Activity,
  history: PastEvent[],
  team: Team,
  slotStart: string,
  resolve: (activityId: string) => Activity | undefined,
): { pass: boolean; penalty: boolean } {
  const slotMs = Date.parse(slotStart);
  const windowMs = team.noveltyWeeks * WEEK_MS;
  const pass = !history.some(
    (e) => e.activityId === activity.id && Math.abs(slotMs - Date.parse(e.start)) <= windowMs,
  );
  const last = lastEventBefore(history, slotMs);
  const lastCategory = last ? resolve(last.activityId)?.category : undefined;
  return { pass, penalty: lastCategory !== undefined && lastCategory === activity.category };
}

/** Most recent event starting at or before `ms`; ties broken by id for determinism. */
export function lastEventBefore(history: PastEvent[], ms: number): PastEvent | undefined {
  let best: PastEvent | undefined;
  for (const e of history) {
    const s = Date.parse(e.start);
    if (s > ms) continue;
    if (!best || s > Date.parse(best.start) || (s === Date.parse(best.start) && e.id > best.id)) best = e;
  }
  return best;
}
