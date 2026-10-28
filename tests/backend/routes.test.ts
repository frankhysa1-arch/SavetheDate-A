import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getEvents } from "@/app/api/events/route";
import { GET as getMembers } from "@/app/api/members/route";
import { GET as getMember, PUT as putMember } from "@/app/api/members/[id]/route";
import { POST as postPlan } from "@/app/api/plan/route";
import { POST as postRating } from "@/app/api/ratings/route";
import { GET as getResult } from "@/app/api/result/route";
import { GET as getIcs } from "@/app/api/result/ics/route";
import { GET as getLatest } from "@/app/api/runs/latest/route";
import { DELETE as deleteCandidate } from "@/app/api/runs/[runId]/candidates/[candidateId]/route";
import { GET as getTeam, PUT as putTeam } from "@/app/api/team/route";
import { POST as postVote } from "@/app/api/votes/route";
import { GET as getTally } from "@/app/api/votes/tally/route";
import type { Candidate, Run } from "@/lib/types";
import { req, useTestEnv } from "./helpers";

let dir: string;
let cleanup: () => void;
beforeEach(() => ({ dir, cleanup } = useTestEnv()));
afterEach(() => cleanup());

const id = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const body = async <T = any>(r: Response): Promise<T> => (await r.json()) as T; // eslint-disable-line @typescript-eslint/no-explicit-any

async function plan(): Promise<Run> {
  const res = await postPlan();
  expect(res.status).toBe(200);
  return body<Run>(res);
}
const vote = (runId: string, memberId: string, ranking: string[]) => postVote(req("POST", "/api/votes", { runId, memberId, ranking }));

describe("members, ratings and privacy", () => {
  it("lists names only, and a member record is only served for the requested id", async () => {
    const list = await body<Record<string, unknown>[]>(await getMembers());
    expect(list).toHaveLength(4);
    expect(Object.keys(list[0]).sort()).toEqual(["id", "name"]);
    expect(JSON.stringify(list)).not.toContain("vegetarian"); // m1's constraint

    const own = await body(await getMember(req("GET", "/api/members/m1"), id({ id: "m1" })));
    expect(own.constraints).toEqual({ diet: "vegetarian" });
    expect(JSON.stringify(own)).not.toContain("noAlcohol"); // m3's constraint
    expect((await getMember(req("GET", "/"), id({ id: "zz" }))).status).toBe(404);
  });

  it("updates categories and tags, validates them, and leaves constraints alone", async () => {
    const ok = await putMember(req("PUT", "/", { categories: ["wellness", "wellness"], tags: ["yoga"] }), id({ id: "m1" }));
    const m = await body(ok);
    expect(m).toMatchObject({ categories: ["wellness"], tags: ["yoga"], constraints: { diet: "vegetarian" } });
    expect((await putMember(req("PUT", "/", { categories: ["bogus"], tags: [] }), id({ id: "m1" }))).status).toBe(400);
    expect((await putMember(req("PUT", "/", { categories: [], tags: [] }), id({ id: "zz" }))).status).toBe(404);
  });

  it("validates ratings and exposes only the team average on /events", async () => {
    expect((await postRating(req("POST", "/", { eventId: "e1", memberId: "m1", score: 6 }))).status).toBe(400);
    expect((await postRating(req("POST", "/", { eventId: "e1", memberId: "m1", score: 3.5 }))).status).toBe(400);
    expect((await postRating(req("POST", "/", { eventId: "nope", memberId: "m1", score: 3 }))).status).toBe(404);
    expect((await postRating(req("POST", "/", { eventId: "e1", memberId: "nope", score: 3 }))).status).toBe(404);
    for (const [m, s] of [["m1", 2], ["m1", 4], ["m2", 5]] as const) {
      expect((await postRating(req("POST", "/", { eventId: "e1", memberId: m, score: s }))).status).toBe(200);
    }
    const events = await body<Record<string, unknown>[]>(await getEvents());
    const e1 = events.find((e) => e.id === "e1")!;
    expect(e1).toMatchObject({ activityName: "Bistro Lunch", teamAvgRating: 4.5 });
    expect(events.find((e) => e.id === "e2")?.teamAvgRating).toBeNull();
    expect(JSON.stringify(events)).not.toContain("memberId");
  });
});

describe("team", () => {
  it("returns defaults, applies a valid partial update and persists it atomically", async () => {
    expect((await body(await getTeam())).limit).toBe(40);
    const res = await putTeam(req("PUT", "/", { limit: 55, attendanceThresholdPct: 60 }));
    expect(await body(res)).toMatchObject({ limit: 55, attendanceThresholdPct: 60, windowDays: 14 });
    const file = path.join(dir, "team.json");
    expect(JSON.parse(fs.readFileSync(file, "utf8")).limit).toBe(55);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]); // temp file was renamed away
    expect((await body(await getTeam())).limit).toBe(55);
  });

  it("rejects nonsense and leaves the file unchanged", async () => {
    await putTeam(req("PUT", "/", { limit: 50 }));
    const file = path.join(dir, "team.json");
    const before = fs.readFileSync(file, "utf8");
    for (const bad of [
      { limit: -5 },
      { limit: 0 },
      { attendanceThresholdPct: 101 },
      { windowDays: 0 },
      { currency: "USD" },
      { timeWindows: [{ days: [1], start: "20:00", end: "17:00" }] },
      { timeWindows: [{ days: [7], start: "10:00", end: "12:00" }] },
      { surprise: true },
    ]) {
      const res = await putTeam(req("PUT", "/", bad));
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect((await body(res)).error).toEqual(expect.any(String));
    }
    expect(fs.readFileSync(file, "utf8")).toBe(before);
  });
});

describe("planning", () => {
  it("runs with no API key, persists the run, and /runs/latest returns it", async () => {
    expect(await body(await getLatest())).toBeNull();
    const run = await plan();
    expect(run.candidates.length).toBeGreaterThan(0);
    expect(run.candidates.every((c) => c.explanation.length > 0)).toBe(true); // template explanations
    expect(await body(await getLatest())).toEqual(run);
    const second = await plan();
    expect((await body<Run>(await getLatest())).id).toBe(second.id);
  });

  it("deleting a candidate removes it from the run and from existing ballots", async () => {
    const run = await plan();
    const [a, b, c] = run.candidates.map((x) => x.id);
    await vote(run.id, "m1", [a, b, c]);
    const res = await deleteCandidate(req("DELETE", "/"), id({ runId: run.id, candidateId: b }));
    const updated = await body<Run>(res);
    expect(updated.candidates.map((x) => x.id)).not.toContain(b);
    const tally = await body(await getTally(req("GET", `/api/votes/tally?runId=${run.id}`)));
    expect(tally.rows.some((r: { candidateId: string }) => r.candidateId === b)).toBe(false);
    expect(tally.rows.find((r: { candidateId: string }) => r.candidateId === a).points).toBe(3);
    expect((await deleteCandidate(req("DELETE", "/"), id({ runId: run.id, candidateId: b }))).status).toBe(404);
    expect((await deleteCandidate(req("DELETE", "/"), id({ runId: "nope", candidateId: a }))).status).toBe(404);
  });
});

describe("voting, result and invite", () => {
  it("validates ballots", async () => {
    const run = await plan();
    const [a, b, c] = run.candidates.map((x) => x.id);
    expect((await vote(run.id, "m1", [a, a, b])).status).toBe(400); // duplicate
    expect((await vote(run.id, "m1", [a, b])).status).toBe(400); // too short
    expect((await vote(run.id, "m1", [a, b, "ghost"])).status).toBe(400); // not in run
    expect((await vote("nope", "m1", [a, b, c])).status).toBe(404);
    expect((await vote(run.id, "nobody", [a, b, c])).status).toBe(404);
  });

  it("has no winner and no invite until someone votes", async () => {
    await plan();
    const result = await body(await getResult(req("GET", "/api/result")));
    expect(result.winner).toBeNull();
    expect(result.ranking.length).toBeGreaterThan(0);
    const ics = await getIcs(req("GET", "/api/result/ics"));
    expect(ics.status).toBe(404);
    expect((await body(ics)).error).toEqual(expect.any(String));
  });

  it("tallies ballots, lets members re-vote, and serves the winner's .ics", async () => {
    const run = await plan();
    const [a, b, c] = run.candidates.map((x) => x.id);
    await vote(run.id, "m1", [a, b, c]);
    await vote(run.id, "m2", [b, a, c]);
    await vote(run.id, "m3", [b, c, a]);
    let tally = await body(await getTally(req("GET", `/api/votes/tally?runId=${run.id}`)));
    expect(tally.ballotsCast).toBe(3);
    expect(tally.rows[0]).toMatchObject({ candidateId: b, points: 8, firstChoiceVotes: 2 });

    await vote(run.id, "m2", [a, b, c]); // re-vote replaces m2's ballot
    await vote(run.id, "m3", [a, c, b]);
    tally = await body(await getTally(req("GET", `/api/votes/tally?runId=${run.id}`)));
    expect(tally.ballotsCast).toBe(3);
    expect(tally.rows[0]).toMatchObject({ candidateId: a, points: 9 });

    const result = await body<{ winner: Candidate; ranking: { candidateId: string; candidate: Candidate }[] }>(await getResult(req("GET", "/api/result")));
    expect(result.winner.id).toBe(a);
    expect(result.ranking[0].candidate.id).toBe(a);

    const ics = await getIcs(req("GET", `/api/result/ics?runId=${run.id}`));
    expect(ics.status).toBe(200);
    expect(ics.headers.get("Content-Type")).toContain("text/calendar");
    expect(ics.headers.get("Content-Disposition")).toContain("attachment");
    const text = await ics.text();
    expect(text).toContain("BEGIN:VEVENT\r\n");
    expect(text).toContain(`UID:${a}@savethedate`);
  });

  it("returns 404 for an unknown runId and an empty tally when no run exists yet", async () => {
    expect((await getTally(req("GET", "/api/votes/tally?runId=nope"))).status).toBe(404);
    expect(await body(await getTally(req("GET", "/api/votes/tally")))).toEqual({ rows: [], ballotsCast: 0 });
    expect(await body(await getResult(req("GET", "/api/result")))).toEqual({ winner: null, ranking: [] });
  });
});
