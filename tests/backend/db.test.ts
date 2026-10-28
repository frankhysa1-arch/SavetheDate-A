import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getMember, getRun, latestRun, listRatings, listVotes, openDb, removeCandidate, saveBallot, saveRun, teamAvgRatings,
  updateMemberPrefs, upsertRating,
} from "@/lib/db";
import type { Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import type { Activity, Run } from "@/lib/types";
import { candidate, useTestEnv } from "./helpers";

let db: Db;
let cleanup: () => void;
beforeEach(() => ({ db, cleanup } = useTestEnv()));
afterEach(() => cleanup());

const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const run: Run = { id: "r1", createdAt: "2026-10-28T10:00:00.000Z", candidates: [candidate("c1"), candidate("c2"), candidate("c3")], emptyCategories: [], discovered: [] };

describe("seed", () => {
  it("is idempotent and never overwrites edited preferences", () => {
    expect(count("member")).toBe(4);
    expect(count("event")).toBe(2);
    updateMemberPrefs(db, "m1", ["wellness"], ["yoga"]);
    seed(db);
    seed(db);
    expect(count("member")).toBe(4);
    expect(count("event")).toBe(2);
    expect(getMember(db, "m1")?.categories).toEqual(["wellness"]);
  });
});

describe("ratings", () => {
  it("upserts one rating per member and event and averages them", () => {
    upsertRating(db, "e1", "m1", 2);
    upsertRating(db, "e1", "m1", 5); // replaces
    upsertRating(db, "e1", "m2", 4);
    expect(listRatings(db)).toHaveLength(2);
    expect(teamAvgRatings(db).get("e1")).toBe(4.5);
    expect(teamAvgRatings(db).has("e2")).toBe(false);
  });

  it("rejects out-of-range scores at the database level", () => {
    expect(() => upsertRating(db, "e1", "m1", 6)).toThrow();
  });
});

describe("runs and contract v2 discovered activities", () => {
  const disc: Activity = { id: "disc:abc1234567", name: "Rooftop Yoga", category: "wellness", tags: [], indoor: false, pricePerPerson: 15, priceIsEstimate: true, sourceUrl: "https://example.com/yoga" };

  it("round-trips discovered activities and returns the latest run", () => {
    saveRun(db, { ...run, id: "r2", createdAt: "2026-10-29T10:00:00.000Z", discovered: [disc] });
    expect(getRun(db, "r2")?.discovered).toEqual([disc]);
    expect(latestRun(db)?.id).toBe("r2");
  });

  it("migrates a run table created before v2 and reads old rows with discovered: []", () => {
    const file = path.join(os.tmpdir(), `savethedate-migrate-${process.pid}.db`);
    fs.rmSync(file, { force: true });
    const legacy = new Database(file);
    legacy.exec("CREATE TABLE run (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, candidates TEXT NOT NULL, empty_categories TEXT NOT NULL DEFAULT '[]')");
    legacy.prepare("INSERT INTO run (id, created_at, candidates) VALUES ('old', '2026-10-01T00:00:00.000Z', '[]')").run();
    legacy.close();
    const migrated = openDb(file); // runs migrate()
    expect(getRun(migrated, "old")?.discovered).toEqual([]);
    openDb(file).close(); // second open is a no-op
    migrated.close();
    fs.rmSync(file, { force: true });
  });
});

describe("ballots", () => {
  beforeEach(() => saveRun(db, run));

  it("re-voting replaces the member's whole ballot", () => {
    saveBallot(db, "r1", "m1", ["c1", "c2", "c3"]);
    saveBallot(db, "r1", "m2", ["c2", "c1", "c3"]);
    saveBallot(db, "r1", "m1", ["c3", "c2", "c1"]);
    const m1 = listVotes(db, "r1").filter((v) => v.memberId === "m1").map((v) => [v.rank, v.candidateId]);
    expect(m1).toEqual([[1, "c3"], [2, "c2"], [3, "c1"]]);
    expect(listVotes(db, "r1")).toHaveLength(6);
  });

  it("keeps (run, member, rank) unique", () => {
    saveBallot(db, "r1", "m1", ["c1", "c2", "c3"]);
    expect(() => db.prepare("INSERT INTO vote (run_id, member_id, candidate_id, rank) VALUES ('r1','m1','c3',1)").run()).toThrow();
  });

  it("removing a candidate drops it from the run and from every ballot", () => {
    saveBallot(db, "r1", "m1", ["c1", "c2", "c3"]);
    const updated = removeCandidate(db, "r1", "c2");
    expect(updated?.candidates.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(listVotes(db, "r1").map((v) => v.candidateId)).toEqual(["c1", "c3"]);
    expect(removeCandidate(db, "r1", "c2")).toBeNull();
    expect(removeCandidate(db, "nope", "c1")).toBeNull();
  });
});
