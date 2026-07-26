import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionSortSelect from "./SectionSortSelect";
import {
  RESULTS_ANSWER_BODY,
  RESULTS_ITEM_HEADER,
  RESULTS_ITEM_SHELL,
  RESULTS_ROW_DETAIL,
  RESULTS_ROW_TITLE,
  RESULTS_SORT_LABEL,
  RESULTS_STATUS_OK,
  RESULTS_SUBTITLE_TEAL,
  RESULTS_SCORE_BADGE,
  RESULTS_BODY_MUTED,
} from "../resultsTypography";
import { HUB_TOP_BODY } from "../hubSectionStyles";
import { formatSubjectLabel } from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import { formatWeightedTestScore } from "../testUtils";
import {
  SECTION_SORT_OPTIONS,
  SECTION_SORT_TIME,
  sortPracticeItems,
} from "../sectionSortUtils";

function TestAnalyseAction({ attemptId, analyzed, compact = false }) {
  const className = compact
    ? "inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 transition"
    : "inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900 transition";

  if (analyzed) {
    return (
      <span
        className={`${className} opacity-40 cursor-not-allowed`}
        title="Already analyzed"
        aria-disabled="true"
      >
        Analyse
      </span>
    );
  }

  return (
    <Link
      to={`/admin/analysis?view=tests&attempt=${attemptId}`}
      className={`${className} hover:bg-indigo-100`}
      onClick={(event) => event.stopPropagation()}
    >
      {compact ? "Analyse" : "Analyse test"}
    </Link>
  );
}

/**
 * Completed adaptive test results for admin Results → Tests.
 */
export default function TestResultsSection({
  results,
  openIds,
  toggleOpen,
  embedded = false,
}) {
  const [sortMode, setSortMode] = useState(SECTION_SORT_TIME);

  const sortedItems = useMemo(
    () => sortPracticeItems(results, sortMode),
    [results, sortMode],
  );

  if (results.length === 0) return null;

  const listContent = (
    <div className={embedded ? "flex flex-col gap-3" : `${HUB_TOP_BODY} gap-3`}>
      <div className="flex items-center justify-end gap-2 px-0.5">
        <label htmlFor="test-results-sort" className={RESULTS_SORT_LABEL}>
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
        const analyzed = Boolean(item.analyzed_at);
        return (
          <div key={item.id} className={RESULTS_ITEM_SHELL}>
            <button
              type="button"
              onClick={() => toggleOpen(item.id)}
              aria-expanded={expanded}
              className={RESULTS_ITEM_HEADER}
            >
              <div className="min-w-0 flex-1">
                <p className={RESULTS_ROW_TITLE}>{item.title}</p>
                <p className={RESULTS_SUBTITLE_TEAL}>
                  {formatSubjectLabel(item.subject)} · Test
                </p>
                {item.completed_at ? (
                  <p className={`${RESULTS_ROW_DETAIL} mt-1`}>
                    {new Date(item.completed_at).toLocaleString()}
                  </p>
                ) : null}
                {analyzed ? (
                  <p className={RESULTS_STATUS_OK}>Analyzed</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                <span className={`${RESULTS_SCORE_BADGE} px-2.5 bg-teal-100 text-teal-900 border border-teal-200 font-bold`}>
                  {formatWeightedTestScore(item.weighted_score, item.max_weighted_score)}
                </span>
                {typeof item.correct_count === "number" ? (
                  <p className={`${RESULTS_ROW_DETAIL} tabular-nums`}>
                    {item.correct_count}/{item.total_count} correct
                  </p>
                ) : null}
                {item.duration_seconds != null ? (
                  <p className={`${RESULTS_ROW_DETAIL} tabular-nums`}>
                    {formatDurationSeconds(item.duration_seconds)}
                  </p>
                ) : null}
                {item.test_adaptive !== false ? (
                  <TestAnalyseAction
                    attemptId={item.id}
                    analyzed={analyzed}
                    compact
                  />
                ) : null}
              </div>
            </button>
            {expanded ? (
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 text-sm space-y-3">
                {(item.answers || []).map((a, i) => (
                  <div
                    key={a.question_id || i}
                    className={`rounded-xl border p-3 ${
                      a.correct
                        ? "border-green-200 bg-green-50/50"
                        : "border-red-200 bg-red-50/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {a.prompt || "Question"}
                    </p>
                    <p className={`mt-1 ${RESULTS_ANSWER_BODY}`}>
                      Answer: {a.given || "—"}
                      {!a.correct && a.expected ? (
                        <span className="block text-emerald-800 mt-0.5">
                          Correct: {a.expected}
                        </span>
                      ) : null}
                    </p>
                    {a.tier ? (
                      <p className={`${RESULTS_ROW_DETAIL} mt-1`}>Tier {a.tier}</p>
                    ) : null}
                  </div>
                ))}
                {item.review_id ? (
                  <p className="text-xs text-amber-800 font-medium">
                    Review session #{item.review_id}
                    {item.review_completed ? " — completed" : " — pending"}
                  </p>
                ) : null}
                {item.test_adaptive !== false ? (
                  <TestAnalyseAction attemptId={item.id} analyzed={analyzed} />
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-4">
      <p className="text-sm font-bold text-slate-900">Tests</p>
      <p className={`${RESULTS_BODY_MUTED} mt-0.5`}>
        Adaptive test sittings — weighted scores, separate from regular worksheets.
      </p>
      <p className={`${RESULTS_ROW_DETAIL} font-semibold mt-1 tabular-nums`}>
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>
      <div className="mt-3">{listContent}</div>
    </div>
  );
}
