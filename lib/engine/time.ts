// Timezone-safe local time helpers. Slot windows are local "HH:mm" in the team's
// zone, so slot generation must respect DST (US DST ends 2026-11-01, inside a 14-day window).

/** Single source of truth for the team's zone until Team carries its own field. */
export const TEAM_TZ = "America/Los_Angeles";

export interface LocalParts {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
  dow: number; // 0=Sun..6=Sat
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function localParts(ms: number, tz: string = TEAM_TZ): LocalParts {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(new Date(ms))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second, dow };
}

/** Offset of `tz` from UTC at instant `ms`, in milliseconds (negative west of UTC). */
function offsetMs(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Instant (epoch ms) of a wall-clock time in `tz`. */
export function zonedToMs(
  year: number, month: number, day: number, hour: number, minute: number, tz: string = TEAM_TZ,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = offsetMs(guess, tz);
  const t = guess - off1;
  const off2 = offsetMs(t, tz);
  return off1 === off2 ? t : guess - off2;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO 8601 string with the zone's numeric offset, e.g. 2026-11-02T17:30:00-08:00. */
export function isoInZone(ms: number, tz: string = TEAM_TZ): string {
  const p = localParts(ms, tz);
  const off = Math.round(offsetMs(ms, tz) / 60000);
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Local calendar date key (YYYY-MM-DD), used to look up forecasts. */
export function localDateKey(ms: number, tz: string = TEAM_TZ): string {
  const p = localParts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Calendar arithmetic on a Y-M-D triple (no timezone involved). */
export function addDays(
  y: number, m: number, d: number, n: number,
): { year: number; month: number; day: number; dow: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate(), dow: dt.getUTCDay() };
}

export function parseHHmm(s: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid time "${s}", expected HH:mm`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}
