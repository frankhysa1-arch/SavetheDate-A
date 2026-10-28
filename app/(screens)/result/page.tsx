"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, enrich, type ResultResponse } from "@/lib/api-client";
import { CandidateCard } from "@/components/CandidateCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Spinner } from "@/components/Spinner";
import { formatMoney } from "@/components/format";
import { errMsg, useRunData } from "@/components/useRunData";

function tieNote(res: ResultResponse, price: (id: string) => number | null): string | null {
  const [a, b] = res.ranking;
  if (!a || !b || a.points !== b.points) return null;
  if (a.candidate.attendancePct !== b.candidate.attendancePct) {
    return `Tie on ${a.points} points. The higher attendance (${Math.round(a.candidate.attendancePct)}% against ${Math.round(b.candidate.attendancePct)}%) breaks it.`;
  }
  const pa = price(a.candidate.activityId);
  const pb = price(b.candidate.activityId);
  return `Tie on ${a.points} points and on attendance. The lower price${pa !== null && pb !== null ? ` (${formatMoney(pa)} against ${formatMoney(pb)})` : ""} breaks it.`;
}

export default function ResultPage() {
  const { run, activities, names, loading, error: loadError, reload } = useRunData();
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [icsHref, setIcsHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!run) return;
    let alive = true;
    setBusy(true);
    setError(null);
    Promise.all([api.result(run.id), api.icsHref(run.id)])
      .then(([r, href]) => {
        if (!alive) return;
        setResult(r);
        setIcsHref(href);
      })
      .catch((e: unknown) => alive && setError(errMsg(e)))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [run]);

  if ((loading && !run) || busy) return <Spinner label="Counting the votes" />;
  if (loadError) return <ErrorBanner message={loadError} onRetry={reload} />;
  if (error) return <ErrorBanner message={error} />;

  const title = <h1 className="text-2xl font-semibold tracking-tight">Result</h1>;

  if (!run || !result || !result.winner) {
    return (
      <div className="grid gap-3">
        {title}
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No ballots yet, so there is no winner. Once people vote, the winning option appears here.{" "}
          <Link href="/vote" className="font-medium text-emerald-800 underline underline-offset-2 dark:text-emerald-300">
            Go to Vote
          </Link>
        </p>
      </div>
    );
  }

  const winner = enrich(result.winner, activities);
  const priceOf = (activityId: string) => activities.find((a) => a.id === activityId)?.pricePerPerson ?? null;
  const note = tieNote(result, priceOf);

  return (
    <div className="grid gap-8">
      <header className="grid gap-1">
        {title}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">The team has chosen. Add it to your calendar.</p>
      </header>

      <section aria-label="Winner" className="grid gap-4">
        <h2 className="text-lg font-semibold">Winner</h2>
        <CandidateCard candidate={winner} names={names} highlight />
        {note && (
          <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            {note}
          </p>
        )}
        {icsHref && (
          <div>
            <a
              href={icsHref}
              download="savethedate-invite.ics"
              className="inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600"
            >
              Download invite (.ics)
            </a>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Opens in Outlook, Google Calendar and Apple Calendar.</p>
          </div>
        )}
      </section>

      <section aria-label="Full ranking" className="grid gap-3">
        <h2 className="text-lg font-semibold">Full ranking</h2>
        <ol className="grid gap-2">
          {result.ranking.map((r, i) => {
            const name = activities.find((a) => a.id === r.candidate.activityId)?.name ?? r.candidate.activityId;
            return (
              <li
                key={r.candidateId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span>
                  <span className="mr-3 font-mono text-xs text-zinc-500">{i + 1}</span>
                  <span className="font-medium">{name}</span>
                </span>
                <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                  {r.points} points · {r.firstChoiceVotes} first {r.firstChoiceVotes === 1 ? "choice" : "choices"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
