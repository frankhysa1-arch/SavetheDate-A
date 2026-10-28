import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, toIcsUtc } from "@/lib/ics";
import { candidate } from "./helpers";

const NOW = new Date("2026-10-28T12:00:00Z");
const activity = { name: "Bistro Lunch" };

/** Undo RFC 5545 folding. */
const unfold = (s: string) => s.replace(/\r\n /g, "");

describe("ics", () => {
  it("emits the required VCALENDAR / VEVENT properties with CRLF endings", () => {
    const out = buildIcs(candidate("c1", { explanation: "Nice and cheap." }), activity, NOW);
    expect(out.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(out.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
    expect(out).not.toMatch(/[^\r]\n/); // every LF is preceded by CR
    for (const prop of ["UID:c1@savethedate", "DTSTAMP:20261028T120000Z", "DTSTART:", "DTEND:", "SUMMARY:Bistro Lunch", "DESCRIPTION:"]) {
      expect(out).toContain(prop);
    }
  });

  it("converts the slot to UTC", () => {
    const out = buildIcs(candidate("c1", { slotStart: "2026-11-03T17:30:00+01:00", slotEnd: "2026-11-03T19:30:00+01:00" }), activity, NOW);
    expect(out).toContain("DTSTART:20261103T163000Z");
    expect(out).toContain("DTEND:20261103T183000Z");
    expect(toIcsUtc("2026-07-01T18:00:00+02:00")).toBe("20260701T160000Z"); // DST offset
    expect(() => toIcsUtc("not a date")).toThrow();
  });

  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const out = buildIcs(candidate("c1", { explanation: "Cheap, close; fun" }), { name: "Tapas, Wine; More" }, NOW);
    expect(out).toContain("SUMMARY:Tapas\\, Wine\\; More");
    expect(unfold(out)).toContain("DESCRIPTION:Cheap\\, close\\; fun\\nhttps://example.com/bistro");
  });

  it("folds lines at 75 octets without splitting multibyte characters", () => {
    const long = "é".repeat(100); // 200 bytes
    const out = buildIcs(candidate("c1", { explanation: long }), activity, NOW);
    for (const line of out.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(unfold(out)).toContain(`DESCRIPTION:${long}`);
    expect(foldLine("x".repeat(75))).toBe("x".repeat(75)); // exactly 75 is not folded
    expect(foldLine("x".repeat(76))).toBe(`${"x".repeat(75)}\r\n x`);
  });

  it("falls back to the activity id when the activity is unknown", () => {
    expect(buildIcs(candidate("c1", { activityId: "a-missing" }), undefined, NOW)).toContain("SUMMARY:a-missing");
  });
});
