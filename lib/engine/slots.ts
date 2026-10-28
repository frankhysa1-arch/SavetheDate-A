// Slot finder: generates slots inside the allowed local-time windows, computes
// attendance against the busy map, keeps those meeting the threshold.
import type { BusyMap, Member, Slot, Team } from "@/lib/types";
import { TEAM_TZ, addDays, isoInZone, localParts, parseHHmm, zonedToMs } from "./time";

export const SLOT_STEP_MIN = 30;
export const MAX_SLOTS = 5;
export const MAX_SLOTS_PER_DAY = 2;

const MIN_MS = 60_000;

interface Range { start: number; end: number }

function parseBusy(busy: BusyMap): Map<string, Range[]> {
  const out = new Map<string, Range[]>();
  for (const [id, ranges] of Object.entries(busy)) {
    out.set(id, ranges.map((r) => ({ start: Date.parse(r.start), end: Date.parse(r.end) })));
  }
  return out;
}

/** Half-open overlap: [a.start, a.end) with [b.start, b.end). */
const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;

export function findSlots(
  team: Team, members: Member[], busy: BusyMap, now: string, tz: string = TEAM_TZ,
): Slot[] {
  if (members.length === 0) return [];
  const nowMs = Date.parse(now);
  const today = localParts(nowMs, tz);
  const busyByMember = parseBusy(busy);
  const lengthMs = team.eventLengthMin * MIN_MS;
  const all: Slot[] = [];

  for (let offset = 0; offset < team.windowDays; offset++) {
    const day = addDays(today.year, today.month, today.day, offset);
    for (const w of team.timeWindows) {
      if (!w.days.includes(day.dow)) continue;
      const ws = parseHHmm(w.start);
      const we = parseHHmm(w.end);
      const windowStart = zonedToMs(day.year, day.month, day.day, ws.hour, ws.minute, tz);
      const windowEnd = zonedToMs(day.year, day.month, day.day, we.hour, we.minute, tz);
      for (let s = windowStart; s + lengthMs <= windowEnd; s += SLOT_STEP_MIN * MIN_MS) {
        if (s < nowMs) continue;
        const range = { start: s, end: s + lengthMs };
        const availableMemberIds = members
          .filter((m) => !(busyByMember.get(m.id) ?? []).some((b) => overlaps(b, range)))
          .map((m) => m.id);
        // available*100/total is exact whenever the true ratio is an integer percent.
        const attendancePct = (availableMemberIds.length * 100) / members.length;
        if (attendancePct < team.attendanceThresholdPct) continue;
        all.push({ start: isoInZone(s, tz), end: isoInZone(s + lengthMs, tz), availableMemberIds, attendancePct });
      }
    }
  }

  // Best attendance first, then earliest start (ISO strings in one zone sort by
  // instant except across a DST change, so compare parsed instants).
  all.sort((a, b) => b.attendancePct - a.attendancePct || Date.parse(a.start) - Date.parse(b.start));

  const perDay = new Map<string, number>();
  const picked: Slot[] = [];
  for (const slot of all) {
    const dayKey = slot.start.slice(0, 10);
    const n = perDay.get(dayKey) ?? 0;
    if (n >= MAX_SLOTS_PER_DAY) continue;
    perDay.set(dayKey, n + 1);
    picked.push(slot);
    if (picked.length === MAX_SLOTS) break;
  }
  return picked;
}
