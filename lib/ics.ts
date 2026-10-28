// RFC 5545 invite export. Owned by stream B.
import type { Activity, Candidate } from "@/lib/types";

const CRLF = "\r\n";

/** Escape a TEXT value (RFC 5545 section 3.3.11). Backslash first. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line at 75 octets (section 3.1), never splitting a UTF-8 sequence. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75; // continuation lines start with a space, leaving 74 for content
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
      limit = 74;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join(CRLF + " ");
}

/** ISO 8601 (must carry an offset or Z) to iCalendar UTC form `YYYYMMDDTHHMMSSZ`. */
export function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Build the .ics body for the winning candidate. `now` is injectable for deterministic tests. */
export function buildIcs(candidate: Candidate, activity: Pick<Activity, "name"> | undefined, now = new Date()): string {
  const summary = activity?.name ?? candidate.activityId;
  const description = [candidate.explanation, candidate.sourceUrl].filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SaveTheDate//Team Social Event Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${candidate.id}@savethedate`,
    `DTSTAMP:${toIcsUtc(now.toISOString())}`,
    `DTSTART:${toIcsUtc(candidate.slotStart)}`,
    `DTEND:${toIcsUtc(candidate.slotEnd)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(candidate.sourceUrl ? [`URL:${candidate.sourceUrl}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
