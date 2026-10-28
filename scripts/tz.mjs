// Shared timezone helpers for the mock-data generators. Mirrors TEAM_TZ in lib/engine/time.ts.
export const TZ = "America/Los_Angeles";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", second: "numeric",
});
export const parts = (ms) => Object.fromEntries(fmt.formatToParts(ms).map((p) => [p.type, Number(p.value)]));
const offsetMs = (ms) => {
  const p = parts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
};
/** Local wall-clock time in TZ to UTC ms. Re-checks the offset once to survive DST edges. */
export function zonedToMs(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const ms = guess - offsetMs(guess);
  return guess - offsetMs(ms);
}
