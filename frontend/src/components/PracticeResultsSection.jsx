import { useEffect, useMemo, useState } from "react";
import SectionSortSelect from "./SectionSortSelect";
import CollapsibleSectionHeader from "./CollapsibleSectionHeader";
import { HUB_TOP_BODY, HUB_TOP_HEADER, HUB_TOP_SHELL } from "../hubSectionStyles";
import {
  RESULTS_ANSWER_BODY,
  RESULTS_ANSWER_PROMPT,
  RESULTS_ITEM_HEADER,
  RESULTS_ITEM_SHELL,
  RESULTS_ITEM_TOGGLE,
  RESULTS_ROW_DETAIL,
  RESULTS_ROW_TITLE,
  RESULTS_SORT_LABEL,
  RESULTS_SUBTITLE,
  RESULTS_SCORE_BADGE,
  RESULTS_BODY_MUTED,
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
  scrollToOpenResult = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sortMode, setSortMode] = useState(SECTION_SORT_TIME);

  const sortedItems = useMemo(
    () => sortPracticeItems(results, sortMode),
    [results, sortMode],
  );

  useEffect(() => {
    if (!scrollToOpenResult || openIds.size === 0) return;
    const id = [...openIds][0];
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`practice-result-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openIds, scrollToOpenResult]);

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
                className={RESULTS_ITEM_SHELL}
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
                {expanded ? (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50/30">
                    {item.answers?.length ? (
                      <ul className="flex flex-col gap-3">
                        {item.answers.map((answer, index) => (
                          <li
                            key={answer.question_id || index}
                            className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm"
                          >
                            <p className={RESULTS_ANSWER_PROMPT}>
                              <span className="text-indigo-600 font-normal">
                                {index + 1}.{" "}
                              </span>
                              {answer.prompt}
                            </p>
                            <div className="mt-2 flex flex-col gap-2 text-sm">
                              <p className={RESULTS_ANSWER_BODY}>
                                <span className="font-medium text-slate-700">
                                  Student chose:{" "}
                                </span>
                                {answer.given || (
                                  <span className="text-slate-400 italic">
                                    No answer
                                  </span>
                                )}
                              </p>
                              {answer.expected ? (
                                <p className="text-slate-700">
                                  <span className="font-medium text-slate-600">
                                    Correct:{" "}
                                  </span>
                                  {answer.expected}
                                </p>
                              ) : null}
                              {typeof answer.correct === "boolean" ? (
                                <span
                                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                                    answer.correct
                                      ? "bg-green-50 text-green-800 border-green-200"
                                      : "bg-red-50 text-red-800 border-red-200"
                                  }`}
                                >
                                  {answer.correct ? "Correct" : "Incorrect"}
                                </span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={RESULTS_BODY_MUTED}>
                        No per-question answers were saved for this attempt.
                      </p>
                    )}
                  </div>
                ) : null}
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
          onToggle={() => setIsOpen((value) => !value)}
        />
      </div>
      {isOpen ? listContent : null}
    </div>
  );
}
