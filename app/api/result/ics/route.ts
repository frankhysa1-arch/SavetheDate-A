import { getDb } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { loadActivities } from "@/lib/plan-provider";
import { fail, handle } from "../../_lib/http";
import { computeResult, resolveRun } from "../../_lib/runs";

/** GET /api/result/ics?runId= -> text/calendar attachment for the winner (404 until someone has voted). */
export function GET(req: Request) {
  return handle(() => {
    const db = getDb();
    const { winner } = computeResult(db, resolveRun(db, new URL(req.url).searchParams.get("runId")));
    if (!winner) fail(404, "No winner yet: no votes have been cast");
    const activity = loadActivities().find((a) => a.id === winner.activityId);
    return new Response(buildIcs(winner, activity), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="team-event.ics"',
      },
    });
  });
}
