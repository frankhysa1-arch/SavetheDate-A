import { describe, expect, it } from "vitest";
import { findSlots, MAX_SLOTS } from "@/lib/engine/slots";
import { localParts } from "@/lib/engine/time";
import type { BusyMap } from "@/lib/types";
import { NOW, makeMembers, makeTeam } from "./fixtures";

const members = makeMembers(8);

describe("findSlots", () => {
  it("only produces slots inside the allowed windows", () => {
    const slots = findSlots(makeTeam(), members, {}, NOW);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const p = localParts(Date.parse(s.start));
      const end = localParts(Date.parse(s.end));
      const weekday = p.dow >= 1 && p.dow <= 5;
      if (weekday) {
        expect(p.hour * 60 + p.minute).toBeGreaterThanOrEqual(17 * 60 + 30);
        expect(end.hour * 60 + end.minute).toBeLessThanOrEqual(20 * 60);
      } else {
        expect(p.dow).toBe(6);
        expect(p.hour).toBeGreaterThanOrEqual(12);
        expect(end.hour * 60 + end.minute).toBeLessThanOrEqual(16 * 60);
      }
    }
  });

  it("never returns slots outside windowDays or before now", () => {
    const team = makeTeam({ windowDays: 3 });
    const slots = findSlots(team, members, {}, NOW);
    const last = Date.parse("2026-10-31T00:00:00-07:00");
    for (const s of slots) {
      expect(Date.parse(s.start)).toBeGreaterThanOrEqual(Date.parse(NOW));
      expect(Date.parse(s.start)).toBeLessThan(last);
    }
    // A slot earlier today than `now` is skipped.
    const late = findSlots(makeTeam(), members, {}, "2026-10-28T18:00:00-07:00");
    expect(late.every((s) => Date.parse(s.start) >= Date.parse("2026-10-28T18:00:00-07:00"))).toBe(true);
  });

  it("is capped at 5 slots and at most 2 per day, ranked by attendance then start", () => {
    const slots = findSlots(makeTeam(), members, {}, NOW);
    expect(slots).toHaveLength(MAX_SLOTS);
    const perDay = new Map<string, number>();
    for (const s of slots) perDay.set(s.start.slice(0, 10), (perDay.get(s.start.slice(0, 10)) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
    expect(slots.map((s) => s.start)).toEqual([
      "2026-10-28T17:30:00-07:00", "2026-10-28T18:00:00-07:00",
      "2026-10-29T17:30:00-07:00", "2026-10-29T18:00:00-07:00",
      "2026-10-30T17:30:00-07:00",
    ]);
  });

  it("ranks higher attendance first", () => {
    const busy: BusyMap = {};
    // Everyone but m0 and m1 is busy on Wed 17:30 to 19:30, so that day's early slot has 25% attendance.
    for (const m of members.slice(2)) busy[m.id] = [{ start: "2026-10-28T17:00:00-07:00", end: "2026-10-28T20:00:00-07:00" }];
    const slots = findSlots(makeTeam(), members, busy, NOW);
    expect(slots[0].attendancePct).toBe(100);
    expect(slots.every((s) => !s.start.startsWith("2026-10-28"))).toBe(true);
  });

  it("treats busy ranges as half-open: a meeting ending at slot start does not block it", () => {
    const busy: BusyMap = { m0: [{ start: "2026-10-28T16:00:00-07:00", end: "2026-10-28T17:30:00-07:00" }] };
    const slots = findSlots(makeTeam(), members, busy, NOW);
    expect(slots[0].start).toBe("2026-10-28T17:30:00-07:00");
    expect(slots[0].availableMemberIds).toContain("m0");
  });

  it("55% boundary with 20 members: 11 free passes, 10 free fails", () => {
    const twenty = makeMembers(20);
    const busyFor = (busyCount: number): BusyMap => {
      const b: BusyMap = {};
      for (const m of twenty.slice(0, busyCount)) {
        b[m.id] = [{ start: "2026-10-28T17:00:00-07:00", end: "2026-10-28T20:00:00-07:00" }];
      }
      return b;
    };
    const team = makeTeam({ windowDays: 1 });
    const eleven = findSlots(team, twenty, busyFor(9), NOW);
    expect(eleven[0].attendancePct).toBe(55);
    expect(findSlots(team, twenty, busyFor(10), NOW)).toEqual([]);
  });

  it("emits correct UTC offsets across the US DST change on 2026-11-01", () => {
    const team = makeTeam({
      windowDays: 6,
      timeWindows: [
        { days: [6, 0], start: "12:00", end: "16:00" },
        { days: [1], start: "17:30", end: "20:00" },
      ],
    });
    const slots = findSlots(team, members, {}, "2026-10-30T09:00:00-07:00");
    const starts = slots.map((s) => s.start);
    expect(starts).toContain("2026-10-31T12:00:00-07:00"); // Saturday, still PDT
    expect(starts).toContain("2026-11-01T12:00:00-08:00"); // Sunday, PST after the change
    expect(starts).toContain("2026-11-02T17:30:00-08:00");
    const sunday = slots.find((s) => s.start === "2026-11-01T12:00:00-08:00");
    expect(sunday?.end).toBe("2026-11-01T14:00:00-08:00");
  });

  it("returns nothing for an empty team", () => {
    expect(findSlots(makeTeam(), [], {}, NOW)).toEqual([]);
  });
});
