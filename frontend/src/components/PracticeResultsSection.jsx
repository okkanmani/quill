import { useMemo, useState } from "react";
import SectionSortSelect from "./SectionSortSelect";
import CollapsibleSectionHeader from "./CollapsibleSectionHeader";
import { HUB_TOP_BODY, HUB_TOP_HEADER, HUB_TOP_SHELL } from "../hubSectionStyles";
import {
  RESULTS_ITEM_HEADER,
  RESULTS_ITEM_SHELL,
  RESULTS_ITEM_TOGGLE,
  RESULTS_ROW_DETAIL,
  RESULTS_ROW_TITLE,
  RESULTS_SORT_LABEL,
  RESULTS_SUBTITLE,
  RESULTS_SCORE_BADGE,
} from "../resultsTypography";
import { formatAreaLabel } from "../analysisUtils";
import { formatSubjectLabel } from "../subjectUtils";
import {
  SECTION_SORT_OPTIONS,
  SECTION_SORT_TIME,
  sortPracticeItems,
} from "../sectionSortUtils";

function scoreBadgeClass(item) {
  if (typeof item.score !== "number" || !item.total) {
    return "bg-slate-100 text-slate-700";
  }
  if (item.score === item.total) return "bg-green-100 text-green-700";
  if (item.score >= item.total / 2) return "bg-slate-100 text-slate-700";
  return "bg-red-100 text-red-700";
}

function formatPracticeScoreLine(item) {
  if (typeof item.score !== "number" || !item.total) return "Completed";
  return `${item.score} / ${item.total} correct`;
}

/**
 * Completed focus practice worksheets for admin Results → Revision.
 */
export default function PracticeResultsSection({
  results,
  openIds,
  toggleOpen,
  embedded = false,
  onSectionCollapse,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sortMode, setSortMode] = useState(SECTION_SORT_TIME);

  function toggleSection() {
    setIsOpen((value) => {
      if (value) onSectionCollapse?.();
      return !value;
    });
  }

  const sortedItems = useMemo(
    () => sortPracticeItems(results, sortMode),
    [results, sortMode],
  );

  if (results.length === 0) return null;

  const listContent = (
    <div className={embedded ? "flex flex-col gap-3" : `${HUB_TOP_BODY} gap-3`}>
      <div className="flex items-center justify-end gap-2 px-0.5">
        <label htmlFor="practice-results-sort" className={RESULTS_SORT_LABEL}>
          Sort
        </label>
        <SectionSortSelect
          id="practice-results-sort"
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
            id={expanded ? `practice-result-${item.id}` : undefined}
            className={`${RESULTS_ITEM_SHELL} ${
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
                <p className={RESULTS_SUBTITLE}>
                  {formatSubjectLabel(item.subject)}
                  {item.focus_area_label || item.focus_area
                    ? ` · ${formatAreaLabel(item.focus_area_label || item.focus_area)}`
                    : ""}
                </p>
                <p className={`${RESULTS_ROW_DETAIL} mt-1.5`}>
                  Completed:{" "}
                  {new Date(item.completed_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start sm:items-end gap-1.5">
                <span
                  className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    item.manual
                      ? "bg-violet-50 text-violet-900 border-violet-200"
                      : "bg-indigo-50 text-indigo-900 border-indigo-200"
                  }`}
                >
                  {item.manual ? "Manual" : "AI generated"}
                </span>
                <span
                  className={`${RESULTS_SCORE_BADGE} px-2.5 ${scoreBadgeClass(item)}`}
                >
                  {formatPracticeScoreLine(item)}
                </span>
                <span className={RESULTS_ITEM_TOGGLE}>
                  {expanded ? "Hide answers" : "Show answers"}
                </span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );

  if (embedded) {
    return listContent;
  }

  return (
    <div className={HUB_TOP_SHELL}>
      <div className={HUB_TOP_HEADER}>
        <CollapsibleSectionHeader
          title="Practice"
          meta={`${results.length} result${results.length === 1 ? "" : "s"}`}
          open={isOpen}
          onToggle={toggleSection}
        />
      </div>
      {isOpen ? listContent : null}
    </div>
  );
}
