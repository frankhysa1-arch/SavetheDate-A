import { z } from "zod";
import { eventExists, getDb, getMember, upsertRating } from "@/lib/db";
import { fail, handle, json, readBody } from "../_lib/http";

const RatingSchema = z
  .object({
    eventId: z.string().min(1),
    memberId: z.string().min(1),
    score: z.number().int().min(1).max(5),
  })
  .strict();

/** POST /api/ratings {eventId, memberId, score 1..5} -> {ok:true}. One rating per member and event; re-posting replaces it. */
export function POST(req: Request) {
  return handle(async () => {
    const body = await readBody(req, RatingSchema);
    const db = getDb();
    if (!eventExists(db, body.eventId)) fail(404, `Event not found: ${body.eventId}`);
    if (!getMember(db, body.memberId)) fail(404, `Member not found: ${body.memberId}`);
    upsertRating(db, body.eventId, body.memberId, body.score);
    return json({ ok: true });
  });
}
