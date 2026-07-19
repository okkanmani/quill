import { useMemo, useState } from "react";
import SectionSortSelect from "./SectionSortSelect";
import { formatSubjectLabel } from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import { formatWeightedTestScore } from "../testUtils";
import {
  SECTION_SORT_OPTIONS,
  SECTION_SORT_TIME,
  sortPracticeItems,
} from "../sectionSortUtils";

/**
 * Completed adaptive test results for admin Results → Tests.
 */
export default function TestResultsSection({
  results,
  openIds,
  toggleOpen,
  embedded = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sortMode, setSortMode] = useState(SECTION_SORT_TIME);

  const sortedItems = useMemo(
    () => sortPracticeItems(results, sortMode),
    [results, sortMode],
  );

  if (results.length === 0) return null;

  const listContent = (
    <div className={embedded ? "flex flex-col gap-4" : "p-3 flex flex-col gap-4 bg-slate-50/40"}>
      <div className="flex items-center justify-end gap-2 px-1">
        <label htmlFor="test-results-sort" className="text-xs font-medium text-slate-600">
          Sort
        </label>
        <SectionSortSelect
          id="test-results-sort"
          value={sortMode}
          onChange={setSortMode}
          options={SECTION_SORT_OPTIONS}
        />
      </div>
      {sortedItems.map((item) => {
        const expanded = openIds.has(item.id);
        return (
          <div
            key={item.id}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleOpen(item.id)}
              aria-expanded={expanded}
              className="w-full text-left p-5 hover:bg-slate-50/60 transition flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start"
            >
              <div className="min-w-0 flex-1">
                <p className="text-slate-900 font-semibold text-lg">{item.title}</p>
                <p className="text-teal-700 text-sm mt-1 capitalize">
                  {formatSubjectLabel(item.subject)} · Test
                </p>
                {item.completed_at ? (
                  <p className="text-slate-500 text-xs mt-1">
                    {new Date(item.completed_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-flex rounded-full bg-teal-100 text-teal-900 border border-teal-200 px-3 py-1 text-sm font-bold tabular-nums">
                  {formatWeightedTestScore(item.weighted_score, item.max_weighted_score)}
                </span>
                {typeof item.correct_count === "number" ? (
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {item.correct_count}/{item.total_count} correct
                  </p>
                ) : null}
                {item.duration_seconds != null ? (
                  <p className="text-xs text-slate-500 tabular-nums">
                    {formatDurationSeconds(item.duration_seconds)}
                  </p>
                ) : null}
              </div>
            </button>
            {expanded ? (
              <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 text-sm space-y-3">
                {(item.answers || []).map((a, i) => (
                  <div
                    key={a.question_id || i}
                    className={`rounded-xl border p-3 ${
                      a.correct
                        ? "border-green-200 bg-green-50/50"
                        : "border-red-200 bg-red-50/50"
                    }`}
                  >
                    <p className="font-medium text-slate-900">{a.prompt || "Question"}</p>
                    <p className="mt-1 text-slate-700">
                      Answer: {a.given || "—"}
                      {!a.correct && a.expected ? (
                        <span className="block text-emerald-800 mt-0.5">
                          Correct: {a.expected}
                        </span>
                      ) : null}
                    </p>
                    {a.tier ? (
                      <p className="text-xs text-slate-500 mt-1">Tier {a.tier}</p>
                    ) : null}
                  </div>
                ))}
                {item.review_id ? (
                  <p className="text-xs text-amber-800 font-medium">
                    Review session #{item.review_id}
                    {item.review_completed ? " — completed" : " — pending"}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  if (embedded) return listContent;

  return (
    <div className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full text-left px-4 py-4 border-b transition bg-teal-100/90 hover:bg-teal-100 border-teal-200/80"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-slate-950 text-lg">Tests</p>
            <p className="text-slate-700 text-sm mt-0.5">
              Adaptive test sittings — weighted scores, separate from regular worksheets.
            </p>
            <p className="text-slate-600 text-xs font-semibold mt-1 tabular-nums">
              {results.length} result{results.length === 1 ? "" : "s"}
            </p>
          </div>
          <span className="text-slate-900 text-sm font-bold shrink-0 pt-1">
            {isOpen ? "▼" : "▶"}
          </span>
        </div>
      </button>
      {isOpen ? listContent : null}
    </div>
  );
}
