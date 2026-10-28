"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, type CandidateView } from "@/lib/api-client";
import { CATEGORIES, type Category } from "@/lib/types";
import { CategoryGroup } from "@/components/CategoryGroup";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/components/format";
import { errMsg, useRunData } from "@/components/useRunData";

export default function PlanPage() {
  const { run, setRun, candidates, names, loading, error, setError, reload } = useRunData();
  const [planning, setPlanning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byCat = new Map<Category | null, CandidateView[]>();
    for (const c of candidates) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c]);
    const fixed = CATEGORIES.map((cat) => ({ category: cat as Category | null, items: byCat.get(cat) ?? [] }));
    const other = byCat.get(null);
    return other ? [...fixed, { category: null, items: other }] : fixed;
  }, [candidates]);

  async function runPlanning() {
    setPlanning(true);
    setError(null);
    try {
      setRun(await api.runPlan());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setPlanning(false);
    }
  }

  async function remove(c: CandidateView) {
    if (!run) return;
    const before = run;
    // Optimistic: drop the card now, roll back if the server refuses.
    setRun({ ...run, candidates: run.candidates.filter((x) => x.id !== c.id) });
    setRemovingId(c.id);
    try {
      setRun(await api.removeCandidate(run.id, c.id));
    } catch (e) {
      setRun(before);
      setError(`Could not remove "${c.activityName}". ${errMsg(e)}`);
    } finally {
      setRemovingId(null);
    }
  }

  const total = candidates.length;
  const populated = groups.filter((g) => g.items.length > 0).length;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plan an event</h1>
          <p className="mt-1 max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
            One planning run checks every activity against the team&apos;s budget, calendars, weather and history, then
            shows the best options per category. Remove anything the team should not see, then open the vote.
          </p>
        </div>
        <button
          type="button"
          onClick={runPlanning}
          disabled={planning}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {planning ? <Spinner label="Planning" /> : run ? "Run planning again" : "Run planning"}
        </button>
      </header>

      {error && <ErrorBanner message={error} onRetry={run ? undefined : reload} />}

      {loading && !run ? (
        <Spinner label="Loading the latest run" />
      ) : !run ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No planning run yet. Press &quot;Run planning&quot; to build the first shortlist.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            Run from {formatDate(run.createdAt)}: <strong className="text-foreground">{total}</strong>{" "}
            {total === 1 ? "option" : "options"} in <strong className="text-foreground">{populated}</strong> of{" "}
            {CATEGORIES.length} categories.
            {total > 0 && (
              <>
                {" "}
                Ready?{" "}
                <Link href="/vote" className="font-medium text-emerald-800 underline underline-offset-2 dark:text-emerald-300">
                  Open the vote
                </Link>
                .
              </>
            )}
          </p>
          <div className={`grid gap-8 ${planning ? "opacity-60" : ""}`} aria-busy={planning}>
            {groups.map((g) => (
              <CategoryGroup
                key={g.category ?? "other"}
                category={g.category}
                candidates={g.items}
                names={names}
                onRemove={remove}
                removingId={removingId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
