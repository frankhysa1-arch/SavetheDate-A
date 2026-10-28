import { getDb } from "@/lib/db";
import { handle, json } from "../../_lib/http";
import { computeTally, resolveRun } from "../../_lib/runs";

/** GET /api/votes/tally?runId= -> {rows, ballotsCast}. Defaults to the latest run. */
export function GET(req: Request) {
  return handle(() => {
    const db = getDb();
    const run = resolveRun(db, new URL(req.url).searchParams.get("runId"));
    return json(run ? computeTally(db, run) : { rows: [], ballotsCast: 0 });
  });
}
