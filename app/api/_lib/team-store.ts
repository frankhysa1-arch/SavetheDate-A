// Team settings live in data/team.json. PUT /api/team rewrites it atomically.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { dataDir } from "@/lib/db";
import type { Team } from "@/lib/types";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:mm");

const TimeWindow = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).min(1),
    start: hhmm,
    end: hhmm,
  })
  .refine((w) => w.start < w.end, { message: "start must be before end" });

export const TeamSchema = z.object({
  limit: z.number().positive().max(10_000),
  currency: z.literal("EUR"),
  windowDays: z.number().int().min(1).max(90),
  eventLengthMin: z.number().int().min(15).max(480),
  attendanceThresholdPct: z.number().min(1).max(100),
  noveltyWeeks: z.number().int().min(0).max(52),
  city: z.string().trim().min(1).max(100),
  timeWindows: z.array(TimeWindow).min(1),
});
// Compile-time check that the schema produces exactly the contract's Team type.
const _teamSchemaMatchesContract: z.ZodType<Team> = TeamSchema;
void _teamSchemaMatchesContract;

/** Body of PUT /team: any subset of Team, no unknown keys. */
export const TeamPatchSchema = TeamSchema.partial().strict();

/** Spec section 3 defaults. Used only when data/team.json is missing; the city is a placeholder. */
export const DEFAULT_TEAM: Team = {
  limit: 40,
  currency: "EUR",
  windowDays: 14,
  eventLengthMin: 120,
  attendanceThresholdPct: 55,
  noveltyWeeks: 6,
  city: "Paris",
  timeWindows: [
    { days: [1, 2, 3, 4, 5], start: "17:30", end: "20:00" },
    { days: [6], start: "12:00", end: "16:00" },
  ],
};

function teamFile(): string {
  return path.join(dataDir(), "team.json");
}

export function readTeam(): Team {
  const file = teamFile();
  if (!fs.existsSync(file)) return DEFAULT_TEAM;
  return TeamSchema.parse({ ...DEFAULT_TEAM, ...JSON.parse(fs.readFileSync(file, "utf8")) });
}

/** Write to a temp file in the same directory, then rename over the target. */
export function writeTeam(team: Team): void {
  const file = teamFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(team, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}
