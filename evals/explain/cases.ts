import type { Candidate } from "@/lib/types";
import { cand } from "./world";

export interface EvalCase { name: string; tags: string[]; candidates: Candidate[] }

const base: EvalCase[] = [
  { name: "indoor-basic", tags: ["indoor"], candidates: [cand({ activityId: "act-boulder" })] },
  {
    name: "outdoor-good-weather", tags: ["outdoor", "weather"],
    candidates: [cand({ activityId: "act-kayak", weather: "Sunny, 22°C, rain 5%, wind 8 km/h", attendancePct: 88, availableMemberIds: ["m1","m2","m3","m4","m5","m6","m7"], matchedMemberIds: ["m1","m3","m5","m7"] })],
  },
  { name: "estimated-price", tags: ["estimate", "outdoor"], candidates: [cand({ activityId: "act-rooftop", weather: "Clear, 17°C, rain 0%, wind 6 km/h", matchedMemberIds: ["m2","m4"], criteria: { C1: true, C2: 2, C3: true, C4: true, C5: true, C5penalty: false } })] },
  { name: "price-equals-limit-attendance-at-threshold", tags: ["boundary"], candidates: [cand({ activityId: "act-pottery", attendancePct: 55, availableMemberIds: ["m1","m2","m3","m4","m5"], matchedMemberIds: ["m1","m5"], criteria: { C1: true, C2: 2, C3: null, C4: true, C5: true, C5penalty: false } })] },
  { name: "everyone-matched", tags: ["boundary"], candidates: [cand({ activityId: "act-ramen", attendancePct: 100, availableMemberIds: ["m1","m2","m3","m4","m5","m6","m7","m8"], matchedMemberIds: ["m1","m2","m3","m4","m5","m6","m7","m8"], criteria: { C1: true, C2: 8, C3: null, C4: true, C5: true, C5penalty: false } })] },
  { name: "unicode-member-name", tags: ["unicode"], candidates: [cand({ activityId: "act-museum", matchedMemberIds: ["m8", "m1"], criteria: { C1: true, C2: 2, C3: null, C4: true, C5: true, C5penalty: false } })] },
  { name: "no-forecast", tags: ["weather", "outdoor"], candidates: [cand({ activityId: "act-kayak", weather: "No forecast available", criteria: { C1: true, C2: 3, C3: null, C4: true, C5: true, C5penalty: false } })] },
  { name: "category-penalty", tags: ["scored"], candidates: [cand({ activityId: "act-escape", criteria: { C1: true, C2: 3, C3: null, C4: true, C5: true, C5penalty: true }, score: 0.52 })] },
  { name: "discovered-activity", tags: ["discovered", "estimate"], candidates: [cand({ id: "c-disc", activityId: "disc:3fa9c21b7e", sourceUrl: "https://example.org/sauna", priceIsEstimate: true })] },
  { name: "prompt-injection-in-venue-name", tags: ["adversarial", "estimate"], candidates: [cand({ activityId: "act-spa" })] },
];

// Batch of 24: unique ids, cycling through the base candidates (tests ordering/merge at the run's real size).
const batch: Candidate[] = Array.from({ length: 24 }, (_, i) => {
  const src = base[i % base.length].candidates[0];
  return { ...src, id: `batch-${i + 1}` };
});

export const CASES: EvalCase[] = [
  ...base,
  { name: "two-slots-same-activity", tags: ["batch"], candidates: [
    cand({ activityId: "act-ramen", slotStart: "2026-11-05T17:30:00.000Z", slotEnd: "2026-11-05T19:30:00.000Z" }),
    cand({ activityId: "act-ramen", slotStart: "2026-11-07T12:00:00.000Z", slotEnd: "2026-11-07T14:00:00.000Z", attendancePct: 62 }),
  ] },
  { name: "full-run-24", tags: ["batch"], candidates: batch },
];
