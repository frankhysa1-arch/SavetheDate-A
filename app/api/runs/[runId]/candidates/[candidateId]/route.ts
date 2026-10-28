import { getDb, getRun, removeCandidate } from "@/lib/db";
import { fail, handle, json } from "../../../../_lib/http";

type Ctx = { params: Promise<{ runId: string; candidateId: string }> };

/** DELETE /api/runs/:runId/candidates/:candidateId -> Run. Also drops ballot rows naming the candidate. */
export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { runId, candidateId } = await params;
    const db = getDb();
    if (!getRun(db, runId)) fail(404, `Run not found: ${runId}`);
    return json(removeCandidate(db, runId, candidateId) ?? fail(404, `Candidate not found: ${candidateId}`));
  });
}
