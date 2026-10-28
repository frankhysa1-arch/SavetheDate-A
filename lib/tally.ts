// Pure vote tally. Owned by stream B.
// Points: rank 1 = 3, rank 2 = 2, rank 3 = 1. Ties: higher attendance, then lower price.
import type { Candidate, TallyRow } from "@/lib/types";

export interface VoteInput { memberId: string; candidateId: string; rank: number }

const POINTS: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

/**
 * One row per candidate in the run (zero-point rows included, so a live tally can
 * show everything), best first. Votes naming unknown candidates are ignored.
 * `ballotsCast` counts distinct members that still have at least one counted vote.
 * `priceOf` returns the activity price per person; unknown activities sort last.
 */
export function tallyVotes(
  votes: readonly VoteInput[],
  candidates: readonly Candidate[],
  priceOf: (activityId: string) => number | undefined,
): { rows: TallyRow[]; ballotsCast: number } {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const rows = new Map<string, TallyRow>(
    candidates.map((c) => [c.id, { candidateId: c.id, points: 0, firstChoiceVotes: 0 }]),
  );
  const voters = new Set<string>();

  for (const v of votes) {
    const row = rows.get(v.candidateId);
    const pts = POINTS[v.rank];
    if (!row || pts === undefined) continue;
    row.points += pts;
    if (v.rank === 1) row.firstChoiceVotes += 1;
    voters.add(v.memberId);
  }

  const price = (id: string) => priceOf(byId.get(id)!.activityId) ?? Number.POSITIVE_INFINITY;
  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      byId.get(b.candidateId)!.attendancePct - byId.get(a.candidateId)!.attendancePct ||
      price(a.candidateId) - price(b.candidateId) ||
      a.candidateId.localeCompare(b.candidateId), // stable, deterministic last resort
  );
  return { rows: sorted, ballotsCast: voters.size };
}
