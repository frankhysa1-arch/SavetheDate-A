// Idempotent seeding of members and past events. Owned by stream B.
import fs from "node:fs";
import path from "node:path";
import type { Db } from "@/lib/db";
import { dataDir } from "@/lib/db";
import type { Member, PastEvent } from "@/lib/types";

export interface SeedData { members: Member[]; events: PastEvent[] }

/**
 * Read data/<name>.json, falling back to tests/backend/fixtures/<name>.json until
 * stream A ships the real seed files. Returns null when neither exists.
 */
export function readDataJson<T>(name: string): T | null {
  const candidates = [
    path.join(dataDir(), name),
    path.join(process.cwd(), "tests", "backend", "fixtures", name),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  }
  return null;
}

/**
 * Insert members and past events that are not there yet. Existing rows are never
 * overwritten, so edited preferences survive a restart and re-running is a no-op.
 */
export function seed(db: Db, data?: Partial<SeedData>): void {
  const members = data?.members ?? readDataJson<Member[]>("members.json") ?? [];
  const events = data?.events ?? readDataJson<PastEvent[]>("past-events.json") ?? [];
  const insMember = db.prepare(
    "INSERT OR IGNORE INTO member (id, name, categories, tags, constraints) VALUES (?, ?, ?, ?, ?)",
  );
  const insEvent = db.prepare('INSERT OR IGNORE INTO event (id, activity_id, start, "end") VALUES (?, ?, ?, ?)');
  db.transaction(() => {
    for (const m of members) {
      insMember.run(
        m.id,
        m.name,
        JSON.stringify(m.categories ?? []),
        JSON.stringify(m.tags ?? []),
        JSON.stringify(m.constraints ?? {}),
      );
    }
    for (const e of events) insEvent.run(e.id, e.activityId, e.start, e.end);
  })();
}
