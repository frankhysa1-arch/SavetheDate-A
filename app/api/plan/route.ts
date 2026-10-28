import { getDb } from "@/lib/db";
import { handle, json } from "../_lib/http";
import { createRun } from "../_lib/runs";

/** POST /api/plan -> Run. Plans, adds explanations (Claude or template), persists the run. */
export function POST() {
  return handle(async () => json(await createRun(getDb())));
}
