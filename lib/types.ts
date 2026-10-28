// Shared contract types. Source of truth: workstreams/CONTRACT.md (frozen).
// Change only through a PR to `main` approved by all three stream owners.
import { z } from "zod";

export const CATEGORIES = [
  "dining", "drinks", "outdoor", "sports",
  "culture", "games", "creative", "wellness",
] as const;                       // 8 categories, final for the MVP
export type Category = (typeof CATEGORIES)[number];

export interface Team {
  limit: number;                  // EUR per person, default 40
  currency: "EUR";
  windowDays: number;             // default 14
  eventLengthMin: number;         // default 120
  attendanceThresholdPct: number; // default 55
  noveltyWeeks: number;           // default 6
  city: string;
  timeWindows: { days: number[]; start: string; end: string }[]; // days 0=Sun..6=Sat, "HH:mm"
}

export interface Member {
  id: string; name: string;
  categories: Category[];         // liked categories
  tags: string[];                 // liked activity ids or free tags
  constraints: Record<string, unknown>; // private, never returned to other members
}

export interface Activity {
  id: string; name: string; category: Category; tags: string[];
  indoor: boolean; pricePerPerson: number; priceIsEstimate: boolean;
  sourceUrl: string;
}

export interface PastEvent { id: string; activityId: string; start: string; end: string } // ISO 8601
export interface Rating { id: string; eventId: string; memberId: string; score: 1|2|3|4|5 }

export type BusyMap = Record<string, { start: string; end: string }[]>; // memberId -> busy ISO ranges
export interface Forecast { date: string; rainPct: number; tempC: number; windKmh: number; summary: string }

export interface Slot {
  start: string; end: string;
  availableMemberIds: string[]; attendancePct: number;
}

export interface Candidate {
  id: string; activityId: string; slotStart: string; slotEnd: string;
  attendancePct: number; availableMemberIds: string[]; matchedMemberIds: string[];
  weather: string;
  criteria: { C1: boolean; C2: number; C3: boolean | null; C4: boolean; C5: boolean; C5penalty: boolean };
  score: number;                  // 0..1
  explanation: string;            // "" when produced by the engine, filled by stream B
  priceIsEstimate: boolean; sourceUrl: string;
}

/** Runtime validator for `Candidate`. Inferred type is asserted equal below. */
export const CandidateSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  slotStart: z.string(),
  slotEnd: z.string(),
  attendancePct: z.number(),
  availableMemberIds: z.array(z.string()),
  matchedMemberIds: z.array(z.string()),
  weather: z.string(),
  criteria: z.object({
    C1: z.boolean(),
    C2: z.number(),
    C3: z.boolean().nullable(),
    C4: z.boolean(),
    C5: z.boolean(),
    C5penalty: z.boolean(),
  }),
  score: z.number().min(0).max(1),
  explanation: z.string(),
  priceIsEstimate: z.boolean(),
  sourceUrl: z.string(),
});

// Compile-time guard: fails `npm run typecheck` if the schema and the
// interface ever drift apart (in either direction).
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const _candidateSchemaMatchesInterface: Equals<z.infer<typeof CandidateSchema>, Candidate> = true;
void _candidateSchemaMatchesInterface;

export interface PlanContext {
  team: Team; members: Member[]; activities: Activity[];
  history: PastEvent[]; ratings: Rating[]; busy: BusyMap;
  forecastFor: (dateISO: string) => Forecast | null;
  now: string;                    // ISO, injected so tests are deterministic
}
export interface PlanResult { candidates: Candidate[]; emptyCategories: Category[] }

export interface Run { id: string; createdAt: string; candidates: Candidate[]; emptyCategories: Category[] }
export interface Ballot { runId: string; memberId: string; ranking: [string, string, string] } // candidate ids, best first
export interface TallyRow { candidateId: string; points: number; firstChoiceVotes: number }
