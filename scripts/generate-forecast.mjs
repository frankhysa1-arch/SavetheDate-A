// Writes data/forecast.json relative to today (fallback forecast, one row per local day).
// Usage: node scripts/generate-forecast.mjs [days=28]
// The first Wednesday slot still ahead of us is stormy, so outdoor candidates fail C3 there
// and move to the next Wednesday. If only one such Wednesday is in range, it stays fair so
// the outdoor category is not wiped out. Other days cycle through mild patterns.
import fs from "node:fs";
import path from "node:path";
import { parts, zonedToMs } from "./tz.mjs";

const days = Number(process.argv[2] ?? 28);
const FAIR = { rainPct: 5, tempC: 17, windKmh: 12, summary: "Clear" };
const STORM = { rainPct: 80, tempC: 11, windKmh: 22, summary: "Heavy rain" };
const CYCLE = [
  { rainPct: 10, tempC: 16, windKmh: 14, summary: "Mostly sunny" },
  { rainPct: 25, tempC: 14, windKmh: 18, summary: "Partly cloudy" },
  { rainPct: 35, tempC: 13, windKmh: 26, summary: "Breezy, light drizzle possible" },
  { rainPct: 5, tempC: 19, windKmh: 10, summary: "Clear" },
];

const now = Date.now();
const today = parts(now);
const rows = [];
for (let i = 0; i < days; i++) {
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
  const [y, mo, d, dow] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay()];
  const key = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const viableWed = dow === 3 && zonedToMs(y, mo, d, 17, 30) > now;
  rows.push({ date: key, viableWed, weather: CYCLE[i % CYCLE.length] });
}
const wednesdays = rows.filter((r) => r.viableWed);
const forecast = rows.map((r) => ({
  date: r.date,
  ...(r.viableWed ? (r === wednesdays[0] && wednesdays.length > 1 ? STORM : FAIR) : r.weather),
}));

const out = path.join(process.cwd(), "data", "forecast.json");
fs.writeFileSync(out, JSON.stringify(forecast, null, 2) + "\n");
const stormy = forecast.find((f) => f.summary === STORM.summary);
console.log(`wrote ${out} (${days} days from ${today.year}-${today.month}-${today.day}); stormy Wednesday: ${stormy?.date ?? "none"}`);
