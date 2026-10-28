// SQLite persistence (better-sqlite3, plain SQL). Owned by stream B.
// Five tables per spec section 4; `run` also stores `empty_categories` so a Run round-trips.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seed } from "@/lib/seed"; // cycle with seed.ts is safe: each only calls the other inside functions
import type { Activity, Candidate, Category, Member, PastEvent, Rating, Run } from "@/lib/types";

export type Db = Database.Database;

export interface VoteRow { memberId: string; candidateId: string; rank: number }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS member (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  categories TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  constraints TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rating (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES event(id),
  member_id TEXT NOT NULL REFERENCES member(id),
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  UNIQUE (event_id, member_id)
);
CREATE TABLE IF NOT EXISTS run (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  candidates TEXT NOT NULL,
  empty_categories TEXT NOT NULL DEFAULT '[]',
  discovered TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS vote (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES run(id),
  member_id TEXT NOT NULL REFERENCES member(id),
  candidate_id TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  UNIQUE (run_id, member_id, rank)
);
`;

/** Directory holding data/*.json and app.db. `DATA_DIR` overrides it (tests). */
export function dataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Bring a database created by an older build up to the current schema. Idempotent. */
function migrate(db: Db): void {
  const cols = (db.prepare("PRAGMA table_info(run)").all() as { name: string }[]).map((c) => c.name);
  // Contract v2: agent-found activities are stored with the run.
  if (!cols.includes("discovered")) db.exec("ALTER TABLE run ADD COLUMN discovered TEXT NOT NULL DEFAULT '[]'");
}

// Cached on globalThis so Next dev hot reloads don't open a second connection.
const g = globalThis as unknown as { __savethedateDb?: Db };

/** Process-wide connection, created and seeded on first use. */
export function getDb(): Db {
  if (!g.__savethedateDb) {
    const db = openDb(process.env.DB_PATH ?? path.join(dataDir(), "app.db"));
    seed(db);
    g.__savethedateDb = db;
  }
  return g.__savethedateDb;
}

/** Swap (or clear with null) the process-wide connection. Tests only. */
export function setDb(db: Db | null): void {
  g.__savethedateDb?.close();
  g.__savethedateDb = db ?? undefined;
}

// ---- members ---------------------------------------------------------------

interface MemberRow { id: string; name: string; categories: string; tags: string; constraints: string }

function toMember(r: MemberRow): Member {
  return {
    id: r.id,
    name: r.name,
    categories: JSON.parse(r.categories) as Category[],
    tags: JSON.parse(r.tags) as string[],
    constraints: JSON.parse(r.constraints) as Record<string, unknown>,
  };
}

export function listMemberNames(db: Db): { id: string; name: string }[] {
  return db.prepare("SELECT id, name FROM member ORDER BY name, id").all() as { id: string; name: string }[];
}

export function listMembers(db: Db): Member[] {
  return (db.prepare("SELECT * FROM member ORDER BY id").all() as MemberRow[]).map(toMember);
}

export function getMember(db: Db, id: string): Member | null {
  const r = db.prepare("SELECT * FROM member WHERE id = ?").get(id) as MemberRow | undefined;
  return r ? toMember(r) : null;
}

export function updateMemberPrefs(db: Db, id: string, categories: Category[], tags: string[]): Member | null {
  const res = db
    .prepare("UPDATE member SET categories = ?, tags = ? WHERE id = ?")
    .run(JSON.stringify(categories), JSON.stringify(tags), id);
  return res.changes ? getMember(db, id) : null;
}

// ---- events and ratings ----------------------------------------------------

export function listEvents(db: Db): PastEvent[] {
  return db
    .prepare('SELECT id, activity_id AS activityId, start, "end" AS "end" FROM event ORDER BY start')
    .all() as PastEvent[];
}

export function eventExists(db: Db, id: string): boolean {
  return !!db.prepare("SELECT 1 FROM event WHERE id = ?").get(id);
}

export function listRatings(db: Db): Rating[] {
  return db
    .prepare("SELECT id, event_id AS eventId, member_id AS memberId, score FROM rating ORDER BY id")
    .all() as Rating[];
}

/** Mean score per event, rounded to 2 dp. Events nobody rated are absent. */
export function teamAvgRatings(db: Db): Map<string, number> {
  const rows = db.prepare("SELECT event_id AS eventId, AVG(score) AS avg FROM rating GROUP BY event_id").all() as {
    eventId: string;
    avg: number;
  }[];
  return new Map(rows.map((r) => [r.eventId, Math.round(r.avg * 100) / 100]));
}

export function upsertRating(db: Db, eventId: string, memberId: string, score: number): void {
  db.prepare(
    `INSERT INTO rating (id, event_id, member_id, score) VALUES (?, ?, ?, ?)
     ON CONFLICT (event_id, member_id) DO UPDATE SET score = excluded.score`,
  ).run(`${eventId}:${memberId}`, eventId, memberId, score);
}

// ---- runs ------------------------------------------------------------------

interface RunRow { id: string; created_at: string; candidates: string; empty_categories: string; discovered: string }

function toRun(r: RunRow): Run {
  return {
    id: r.id,
    createdAt: r.created_at,
    candidates: JSON.parse(r.candidates) as Candidate[],
    emptyCategories: JSON.parse(r.empty_categories) as Category[],
    discovered: JSON.parse(r.discovered) as Activity[],
  };
}

export function saveRun(db: Db, run: Run): void {
  db.prepare("INSERT INTO run (id, created_at, candidates, empty_categories, discovered) VALUES (?, ?, ?, ?, ?)").run(
    run.id,
    run.createdAt,
    JSON.stringify(run.candidates),
    JSON.stringify(run.emptyCategories),
    JSON.stringify(run.discovered),
  );
}

export function getRun(db: Db, id: string): Run | null {
  const r = db.prepare("SELECT * FROM run WHERE id = ?").get(id) as RunRow | undefined;
  return r ? toRun(r) : null;
}

export function latestRun(db: Db): Run | null {
  const r = db.prepare("SELECT * FROM run ORDER BY created_at DESC, rowid DESC LIMIT 1").get() as RunRow | undefined;
  return r ? toRun(r) : null;
}

/** Drop one candidate from a stored run, plus any ballot rows naming it. Null when run or candidate is unknown. */
export function removeCandidate(db: Db, runId: string, candidateId: string): Run | null {
  return db.transaction(() => {
    const run = getRun(db, runId);
    if (!run || !run.candidates.some((c) => c.id === candidateId)) return null;
    const candidates = run.candidates.filter((c) => c.id !== candidateId);
    db.prepare("UPDATE run SET candidates = ? WHERE id = ?").run(JSON.stringify(candidates), runId);
    db.prepare("DELETE FROM vote WHERE run_id = ? AND candidate_id = ?").run(runId, candidateId);
    return { ...run, candidates };
  })();
}

// ---- votes -----------------------------------------------------------------

/** Replace the member's whole ballot for a run in one transaction (re-voting overwrites). */
export function saveBallot(db: Db, runId: string, memberId: string, ranking: readonly string[]): void {
  db.transaction(() => {
    db.prepare("DELETE FROM vote WHERE run_id = ? AND member_id = ?").run(runId, memberId);
    const ins = db.prepare("INSERT INTO vote (run_id, member_id, candidate_id, rank) VALUES (?, ?, ?, ?)");
    ranking.forEach((candidateId, i) => ins.run(runId, memberId, candidateId, i + 1));
  })();
}

export function listVotes(db: Db, runId: string): VoteRow[] {
  return db
    .prepare("SELECT member_id AS memberId, candidate_id AS candidateId, rank FROM vote WHERE run_id = ? ORDER BY id")
    .all(runId) as VoteRow[];
}
