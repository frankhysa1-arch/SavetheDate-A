import { getDb, latestRun } from "@/lib/db";
import { handle, json } from "../../_lib/http";

/** GET /api/runs/latest -> Run | null */
export function GET() {
  return handle(() => json(latestRun(getDb())));
}
