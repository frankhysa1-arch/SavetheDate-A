// Writes data/busy.json relative to today so the mock calendar never goes stale.
// Usage: node scripts/generate-busy.mjs [days=28]
// Pattern (team-local days): Sat, Sun, Mon, Fri everyone busy. Tue only group B busy
// (group A free). Thu only group A busy (group B free). Wed everyone busy until 17:00,
// then free. Groups are 3 of 6, so Tue and Thu sit at 50%, below the 55% threshold.
import fs from "node:fs";
import path from "node:path";

const TZ = "America/Los_Angeles";
const GROUP_A = ["jega", "gabriel", "lucas"];
const GROUP_B = ["romain", "frank", "sky"];
const days = Number(process.argv[2] ?? 28);

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", second: "numeric",
});
const parts = (ms) => Object.fromEntries(fmt.formatToParts(ms).map((p) => [p.type, Number(p.value)]));
const offsetMs = (ms) => {
  const p = parts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
};
/** Local wall-clock time in TZ to UTC ms. Re-checks the offset once to survive DST edges. */
function zonedToMs(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const ms = guess - offsetMs(guess);
  return guess - offsetMs(ms);
}

const today = parts(Date.now());
const busy = Object.fromEntries([...GROUP_A, ...GROUP_B].map((id) => [id, []]));
const push = (id, from, to) =>
  busy[id].push({ start: new Date(from).toISOString(), end: new Date(to).toISOString() });

for (let i = 0; i < days; i++) {
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
  const [y, mo, d, dow] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay()];
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const dayStart = zonedToMs(y, mo, d, 0, 0);
  const dayEnd = zonedToMs(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0);
  for (const id of Object.keys(busy)) {
    if ([6, 0, 1, 5].includes(dow)) push(id, dayStart, dayEnd);              // Sat, Sun, Mon, Fri
    else if (dow === 2 && GROUP_B.includes(id)) push(id, dayStart, dayEnd);  // Tue: only A free
    else if (dow === 4 && GROUP_A.includes(id)) push(id, dayStart, dayEnd);  // Thu: only B free
    else if (dow === 3) push(id, zonedToMs(y, mo, d, 9, 0), zonedToMs(y, mo, d, 17, 0)); // Wed: free from 17:00
  }
}

const out = path.join(process.cwd(), "data", "busy.json");
fs.writeFileSync(out, JSON.stringify(busy, null, 2) + "\n");
console.log(`wrote ${out} (${days} days from ${today.year}-${today.month}-${today.day})`);
