import type { TallyRow } from "@/lib/types";

export function TallyTable({
  rows,
  labels,
  ballotsCast,
  totalMembers,
}: {
  rows: TallyRow[];
  labels: Record<string, string>; // candidateId -> activity name
  ballotsCast: number;
  totalMembers?: number;
}) {
  return (
    <section aria-label="Live tally" className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Live tally</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {ballotsCast} {ballotsCast === 1 ? "ballot" : "ballots"} cast
          {totalMembers ? ` of ${totalMembers} members` : ""}
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No votes yet. The first ballot will show up here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <th scope="col" className="py-2 pr-3 font-medium">#</th>
                <th scope="col" className="py-2 pr-3 font-medium">Option</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Points</th>
                <th scope="col" className="py-2 text-right font-medium">1st choices</th>
              </tr>
            </thead>
            <tbody>
              {[...rows]
                .sort((a, b) => b.points - a.points || b.firstChoiceVotes - a.firstChoiceVotes)
                .map((r, i) => (
                  <tr key={r.candidateId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="py-2 pr-3 tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium">{labels[r.candidateId] ?? r.candidateId}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.points}</td>
                    <td className="py-2 text-right tabular-nums">{r.firstChoiceVotes}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
