import { handle, json, readBody } from "../_lib/http";
import { readTeam, TeamPatchSchema, TeamSchema, writeTeam } from "../_lib/team-store";

/** GET /api/team -> Team */
export function GET() {
  return handle(() => json(readTeam()));
}

/** PUT /api/team (partial Team) -> Team. Validated, then data/team.json is replaced atomically. */
export function PUT(req: Request) {
  return handle(async () => {
    const patch = await readBody(req, TeamPatchSchema);
    const next = TeamSchema.parse({ ...readTeam(), ...patch }); // also catches cross-field problems
    writeTeam(next);
    return json(next);
  });
}
