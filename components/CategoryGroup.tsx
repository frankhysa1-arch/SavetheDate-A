import type { CandidateView } from "@/lib/api-client";
import type { Category } from "@/lib/types";
import { CandidateCard } from "@/components/CandidateCard";
import { CATEGORY_LABEL } from "@/components/format";

export function CategoryGroup({
  category,
  candidates,
  names,
  onRemove,
  removingId,
  emptyText = "No options this run",
}: {
  category: Category | null;
  candidates: CandidateView[];
  names: Record<string, string>;
  onRemove?: (candidate: CandidateView) => void;
  removingId?: string | null;
  emptyText?: string;
}) {
  const title = category ? CATEGORY_LABEL[category] : "Other";
  return (
    <section aria-labelledby={`cat-${category ?? "other"}`} className="grid gap-3">
      <h2 id={`cat-${category ?? "other"}`} className="flex items-baseline gap-2 text-lg font-semibold">
        {title}
        <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">
          {candidates.length} {candidates.length === 1 ? "option" : "options"}
        </span>
      </h2>
      {candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              names={names}
              onRemove={onRemove ? () => onRemove(c) : undefined}
              removing={removingId === c.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
