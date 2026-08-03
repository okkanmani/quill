import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionSortSelect from "./SectionSortSelect";
import {
  RESULTS_ITEM_HEADER,
  RESULTS_ITEM_SHELL,
  RESULTS_ITEM_TOGGLE,
  RESULTS_ROW_DETAIL,
  RESULTS_ROW_TITLE,
  RESULTS_SORT_LABEL,
  RESULTS_STATUS_OK,
  RESULTS_SUBTITLE_TEAL,
  RESULTS_SCORE_BADGE,
  RESULTS_BODY_MUTED,
} from "../resultsTypography";
import { HUB_TOP_BODY } from "../hubSectionStyles";
import {
  ROW_ACTION_BUTTON_CLASS,
  ROW_ACTION_ICON_CLASS,
} from "./rowActionButtonStyles";
import RecycleBinButton from "./RecycleBinButton";
import { formatSubjectLabel } from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import { formatWeightedTestScore } from "../testUtils";
import {
  SECTION_SORT_OPTIONS,
  SECTION_SORT_TIME,
  sortTestResultItems,
} from "../sectionSortUtils";

function AnalyseChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ROW_ACTION_ICON_CLASS}
      aria-hidden="true"
    >
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M22 20H2" />
    </svg>
  );
}

export function TestAnalyseIconLink({ attemptId, analyzed, title, to }) {
  const className = `${ROW_ACTION_BUTTON_CLASS} hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700`;
  const label = analyzed
    ? `Already analyzed: ${title}`
    : `Analyse test: ${title}`;
  const href = to || `/admin/analysis?view=tests&attempt=${attemptId}`;

  if (analyzed) {
    return (
      <span
        className={`${className} opacity-40 cursor-not-allowed`}
        title="Already analyzed"
        aria-label={label}
        aria-disabled="true"
      >
        <AnalyseChartIcon />
      </span>
    );
  }

  return (
    <Link
      to={href}
      className={className}
      title="Analyse test"
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
    >
      <AnalyseChartIcon />
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
  hideSort = false,
  analyseHrefForAttempt,
  onDeleteResult,
  deletingResultId,
}) {
  const [sortMode, setSortMode] = useState(SECTION_SORT_TIME);

  const sortedItems = useMemo(
    () => (hideSort ? results : sortTestResultItems(results, sortMode)),
    [results, sortMode, hideSort],
  );

  if (results.length === 0) return null;

  const listContent = (
    <div className={embedded ? "flex flex-col gap-3" : `${HUB_TOP_BODY} gap-3`}>
      {!hideSort ? (
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
      ) : null}
      {sortedItems.map((item) => {
        const expanded = openIds.has(item.id);
        const analyzed = Boolean(item.analyzed_at);
        const showAnalyse = item.test_adaptive !== false;
        return (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row gap-2 sm:items-stretch sm:gap-1.5"
          >
            <div
              className={`min-w-0 flex-1 ${RESULTS_ITEM_SHELL} ${
                expanded ? "ring-2 ring-indigo-200" : ""
              }`}
            >
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
                  <span
                    className={`${RESULTS_SCORE_BADGE} px-2.5 bg-teal-100 text-teal-900 border border-teal-200 font-bold`}
                  >
                    {formatWeightedTestScore(
                      item.weighted_score,
                      item.max_weighted_score,
                    )}
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
                  <span className={RESULTS_ITEM_TOGGLE}>
                    {expanded ? "Hide answers" : "Show answers"}
                  </span>
                </div>
              </button>
            </div>
            {showAnalyse || onDeleteResult ? (
              <div className="flex shrink-0 self-start sm:self-stretch sm:items-stretch sm:flex-col sm:justify-center gap-2 sm:w-7 pt-3">
                {showAnalyse ? (
                  <TestAnalyseIconLink
                    attemptId={item.id}
                    analyzed={analyzed}
                    title={item.title || "Test"}
                    to={
                      analyseHrefForAttempt
                        ? analyseHrefForAttempt(item)
                        : undefined
                    }
                  />
                ) : null}
                {onDeleteResult ? (
                  <RecycleBinButton
                    onClick={() => onDeleteResult(item)}
                    label={`Delete test result for ${item.title || "Test"}`}
                    disabled={deletingResultId === item.id}
                  />
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
