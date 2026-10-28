import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getMember, listRatings, listVotes, removeCandidate, saveBallot, saveRun, teamAvgRatings, updateMemberPrefs,
  upsertRating,
} from "@/lib/db";
import type { Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { candidate, useTestEnv } from "./helpers";

let db: Db;
let cleanup: () => void;
beforeEach(() => ({ db, cleanup } = useTestEnv()));
afterEach(() => cleanup());

const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const run = { id: "r1", createdAt: "2026-10-28T10:00:00.000Z", candidates: [candidate("c1"), candidate("c2"), candidate("c3")], emptyCategories: [] };

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
