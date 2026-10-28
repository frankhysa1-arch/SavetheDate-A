// Score = 0.35P + 0.20R + 0.20A + 0.15N + 0.10B, clamped to 0..1.
import type { Activity, Category, PastEvent, Rating } from "@/lib/types";

export const WEIGHTS = { P: 0.35, R: 0.2, A: 0.2, N: 0.15, B: 0.1 } as const;
export const DEFAULT_RATING_AFFINITY = 0.5;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export interface ScoreParts { P: number; R: number; A: number; N: number; B: number }

export function computeScore(parts: ScoreParts): number {
  const sum =
    WEIGHTS.P * parts.P + WEIGHTS.R * parts.R + WEIGHTS.A * parts.A + WEIGHTS.N * parts.N + WEIGHTS.B * parts.B;
  return clamp01(sum);
}

/** B: cheaper is better. A zero limit only rewards free activities. */
export function priceScore(price: number, limit: number): number {
  if (limit <= 0) return price <= 0 ? 1 : 0;
  return clamp01(1 - price / limit);
}

/**
 * R: mean of (score-1)/4 over ratings of past events in `category`, 0.5 when there
 * are none. Ratings on events whose activity cannot be resolved are ignored.
 */
export function ratingAffinity(
  category: Category,
  ratings: Rating[],
  history: PastEvent[],
  resolve: (activityId: string) => Activity | undefined,
): number {
  const categoryByEvent = new Map<string, Category | undefined>();
  for (const e of history) categoryByEvent.set(e.id, resolve(e.activityId)?.category);
  const values = ratings
    .filter((r) => categoryByEvent.get(r.eventId) === category)
    .map((r) => (r.score - 1) / 4);
  if (values.length === 0) return DEFAULT_RATING_AFFINITY;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
