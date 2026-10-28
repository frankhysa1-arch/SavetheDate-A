import { getDb, listEvents, teamAvgRatings } from "@/lib/db";
import { loadActivities } from "@/lib/plan-provider";
import { handle, json } from "../_lib/http";

/** GET /api/events -> past events with activityName and the team average rating (individual ratings are never exposed). */
export function GET() {
  return handle(() => {
    const db = getDb();
    const names = new Map(loadActivities().map((a) => [a.id, a.name]));
    const avgs = teamAvgRatings(db);
    return json(
      listEvents(db).map((e) => ({
        ...e,
        activityName: names.get(e.activityId) ?? e.activityId,
        teamAvgRating: avgs.get(e.id) ?? null,
      })),
    );
  });
}
