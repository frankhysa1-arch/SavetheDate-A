import { getDb } from "@/lib/db";
import { handle, json } from "../_lib/http";
import { computeResult, resolveRun } from "../_lib/runs";

/** GET /api/result?runId= -> {winner, ranking}. `winner` is null until at least one ballot is in. */
export function GET(req: Request) {
  return handle(() => {
    const db = getDb();
    return json(computeResult(db, resolveRun(db, new URL(req.url).searchParams.get("runId"))));
  });
}
