// Small helpers shared by the route handlers. `_lib` is a private folder: Next does not route it.
import { z } from "zod";

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/** Run a handler body; turn thrown HttpError / ZodError into `{error}` responses. */
export async function handle(fn: () => Response | Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError) return json({ error: zodMessage(e) }, 400);
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
}

export function zodMessage(e: z.ZodError): string {
  return e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}

/** Parse and validate a JSON request body; 400 on bad JSON or schema mismatch. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    fail(400, "Request body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) fail(400, zodMessage(parsed.error));
  return parsed.data;
}
