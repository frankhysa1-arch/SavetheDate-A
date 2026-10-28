import { z } from "zod";
import { getDb, getMember, getRun, saveBallot } from "@/lib/db";
import { fail, handle, json, readBody } from "../_lib/http";

const BallotSchema = z
  .object({
    runId: z.string().min(1),
    memberId: z.string().min(1),
    ranking: z.tuple([z.string(), z.string(), z.string()]),
  })
  .strict()
  .refine((b) => new Set(b.ranking).size === 3, { message: "ranking must contain 3 distinct candidate ids", path: ["ranking"] });

/** POST /api/votes {runId, memberId, ranking:[1st,2nd,3rd]} -> {ok:true}. Re-voting replaces the member's ballot. */
export function POST(req: Request) {
  return handle(async () => {
    const ballot = await readBody(req, BallotSchema);
    const db = getDb();
    const run = getRun(db, ballot.runId) ?? fail(404, `Run not found: ${ballot.runId}`);
    if (!getMember(db, ballot.memberId)) fail(404, `Member not found: ${ballot.memberId}`);
    const ids = new Set(run.candidates.map((c) => c.id));
    const unknown = ballot.ranking.filter((id) => !ids.has(id));
    if (unknown.length) fail(400, `Candidates not in this run: ${unknown.join(", ")}`);
    saveBallot(db, ballot.runId, ballot.memberId, ballot.ranking);
    return json({ ok: true });
  });
}
