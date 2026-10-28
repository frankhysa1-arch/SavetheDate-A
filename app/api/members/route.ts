import { getDb, listMemberNames } from "@/lib/db";
import { handle, json } from "../_lib/http";

/** GET /api/members -> {id,name}[] (names only; no preferences or constraints). */
export function GET() {
  return handle(() => json(listMemberNames(getDb())));
}
