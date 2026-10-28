// THROWAWAY stub standing in for stream A until it merges (see lib/plan-provider.ts).
// Not named *.test.ts so Vitest does not collect it.
import { CATEGORIES } from "@/lib/types";
import type { Activity, BusyMap, Candidate, Category, Forecast, PlanContext, PlanResult } from "@/lib/types";
import { readDataJson } from "@/lib/seed";

export function loadActivities(): Activity[] {
  return readDataJson<Activity[]>("activities.json") ?? [];
}

export function loadBusy(): BusyMap {
  return readDataJson<BusyMap>("busy.json") ?? {};
}

export function loadForecast(dateISO: string): Forecast | null {
  const all = readDataJson<Forecast[]>("forecast.json");
  return all?.find((f) => f.date === dateISO.slice(0, 10)) ?? null;
}

/** One candidate per activity that fits the budget, on a fixed slot 3 days after `now`. No rules, no scoring. */
export function planCandidates(ctx: PlanContext): PlanResult {
  const day = new Date(Date.parse(ctx.now) + 3 * 86_400_000).toISOString().slice(0, 10);
  const slotStart = `${day}T17:30:00.000Z`;
  const slotEnd = new Date(Date.parse(slotStart) + ctx.team.eventLengthMin * 60_000).toISOString();
  const everyone = ctx.members.map((m) => m.id);
  const perCategory = new Map<Category, number>();
  const candidates: Candidate[] = [];

  for (const a of ctx.activities) {
    if (a.pricePerPerson > ctx.team.limit || (perCategory.get(a.category) ?? 0) >= 2) continue;
    perCategory.set(a.category, (perCategory.get(a.category) ?? 0) + 1);
    candidates.push({
      id: `${a.id}@${slotStart}`,
      activityId: a.id,
      slotStart,
      slotEnd,
      attendancePct: 100,
      availableMemberIds: everyone,
      matchedMemberIds: ctx.members.filter((m) => m.categories.includes(a.category)).map((m) => m.id),
      weather: ctx.forecastFor(day)?.summary ?? "No forecast",
      criteria: { C1: true, C2: 2, C3: a.indoor ? null : true, C4: true, C5: true, C5penalty: false },
      score: 0.5,
      explanation: "",
      priceIsEstimate: a.priceIsEstimate,
      sourceUrl: a.sourceUrl,
    });
  }
  return { candidates, emptyCategories: CATEGORIES.filter((c) => !perCategory.has(c)), discovered: [] };
}
