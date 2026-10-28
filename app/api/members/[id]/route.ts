import { z } from "zod";
import { getDb, getMember, updateMemberPrefs } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";
import { fail, handle, json, readBody } from "../../_lib/http";

type Ctx = { params: Promise<{ id: string }> };

const PrefsSchema = z
  .object({
    categories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
    tags: z.array(z.string().trim().min(1).max(60)).max(50),
  })
  .strict();

/** GET /api/members/:id -> the caller's own record (no auth in the MVP; :id is the "pick your name" choice). */
export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return json(getMember(getDb(), id) ?? fail(404, `Member not found: ${id}`));
  });
}

/** PUT /api/members/:id {categories, tags} -> Member. `constraints` are never touched here. */
export function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const body = await readBody(req, PrefsSchema);
    const updated = updateMemberPrefs(getDb(), id, [...new Set(body.categories)], [...new Set(body.tags)]);
    return json(updated ?? fail(404, `Member not found: ${id}`));
  });
}
