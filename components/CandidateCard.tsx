import type { ReactNode } from "react";
import type { CandidateView } from "@/lib/api-client";
import { CriteriaBadges } from "@/components/CriteriaBadges";
import { CATEGORY_LABEL, formatMoney, formatSlot, joinNames } from "@/components/format";

/**
 * One option on Plan, Vote and Result. Shows every field the plan asks for:
 * name, price (with an "estimate" marker), slot, attendance, matched members,
 * weather, rule badges, explanation and a safe source link.
 */
export function CandidateCard({
  candidate,
  names,
  onRemove,
  removing = false,
  highlight = false,
  footer,
}: {
  candidate: CandidateView;
  names: Record<string, string>;
  onRemove?: () => void;
  removing?: boolean;
  highlight?: boolean;
  footer?: ReactNode;
}) {
  const c = candidate;
  const freeCount = c.availableMemberIds.length;
  return (
    <article
      aria-label={c.activityName}
      className={`grid gap-3 rounded-xl border p-4 shadow-sm ${
        highlight
          ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/30 dark:border-emerald-600 dark:bg-emerald-950/40"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      } ${removing ? "opacity-50" : ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {c.category && (
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              {CATEGORY_LABEL[c.category]}
            </p>
          )}
          <h3 className="text-base font-semibold leading-snug">{c.activityName}</h3>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-lg font-semibold tabular-nums">
            {c.pricePerPerson === null ? "Price unknown" : formatMoney(c.pricePerPerson)}
          </span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">
            per person
            {c.priceIsEstimate && (
              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                estimate
              </span>
            )}
          </span>
        </p>
      </header>

      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">When</dt>
          <dd>{formatSlot(c.slotStart, c.slotEnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">Attendance</dt>
          <dd>
            <span className="font-medium tabular-nums">{Math.round(c.attendancePct)}%</span> free ({freeCount}{" "}
            {freeCount === 1 ? "person" : "people"})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">Matches the interests of</dt>
          <dd>{c.matchedMemberIds.length ? joinNames(c.matchedMemberIds, names) : "Nobody yet"}</dd>
        </div>
        {c.weather && (
          <div>
            <dt className="text-xs text-zinc-600 dark:text-zinc-400">Weather</dt>
            <dd>{c.weather}</dd>
          </div>
        )}
      </dl>

      <CriteriaBadges candidate={c} />

      {c.explanation && <p className="text-sm leading-relaxed">{c.explanation}</p>}

      <footer className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <a
          href={c.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-950 dark:text-emerald-300"
        >
          Source<span className="sr-only"> for {c.activityName} (opens in a new tab)</span>
        </a>
        {footer}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            aria-label={`Remove ${c.activityName} from the shortlist`}
            className="rounded-md border border-zinc-300 px-3 py-1 font-medium hover:bg-zinc-100 disabled:cursor-not-allowed dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        )}
      </footer>
    </article>
  );
}
