import { useMemo, useState } from "react";
import SectionSortSelect from "./SectionSortSelect";
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
}) {
  const [isOpen, setIsOpen] = useState(!embedded);
  const [sortMode, setSortMode] = useState(SECTION_SORT_TIME);

  const sortedItems = useMemo(
    () => sortPracticeItems(results, sortMode),
    [results, sortMode],
  );

  if (results.length === 0) return null;

  const listContent = (
    <div className={embedded ? "flex flex-col gap-4" : "p-3 flex flex-col gap-4 bg-slate-50/40"}>
      <div className="flex items-center justify-end gap-2 px-1">
        <label
          htmlFor="practice-results-sort"
          className="text-xs font-medium text-slate-600"
        >
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
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleOpen(item.id)}
                  aria-expanded={expanded}
                  className="w-full text-left p-5 hover:bg-slate-50/60 transition flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-900 font-semibold text-lg">
                      {item.title}
                    </p>
                    <p className="text-indigo-600 text-sm mt-1 capitalize">
                      {formatSubjectLabel(item.subject)}
                      {item.focus_area_label || item.focus_area
                        ? ` · ${formatAreaLabel(item.focus_area_label || item.focus_area)}`
                        : ""}
                    </p>
                    <p className="text-slate-400 text-xs mt-2">
                      Completed:{" "}
                      {new Date(item.completed_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start sm:items-end gap-2">
                    <span
                      className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        item.manual
                          ? "bg-violet-50 text-violet-900 border-violet-200"
                          : "bg-indigo-50 text-indigo-900 border-indigo-200"
                      }`}
                    >
                      {item.manual ? "Manual" : "AI generated"}
                    </span>
                    <span
                      className={`inline-flex text-sm font-semibold px-3 py-1 rounded-full tabular-nums ${scoreBadgeClass(item)}`}
                    >
                      {formatPracticeScoreLine(item)}
                    </span>
                    <span className="text-slate-600 text-xs font-semibold underline underline-offset-2">
                      {expanded ? "Hide answers" : "Show answers"}
                    </span>
                  </div>
                </button>
                {expanded ? (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4 bg-slate-50/30">
                    {item.answers?.length ? (
                      <ul className="flex flex-col gap-4">
                        {item.answers.map((answer, index) => (
                          <li
                            key={answer.question_id || index}
                            className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm"
                          >
                            <p className="text-slate-800 text-sm font-medium leading-snug">
                              <span className="text-indigo-500 font-normal">
                                {index + 1}.{" "}
                              </span>
                              {answer.prompt}
                            </p>
                            <div className="mt-3 flex flex-col gap-2 text-sm">
                              <p className="text-slate-700">
                                <span className="font-medium text-slate-600">
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
                      <p className="text-sm text-slate-500">
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
    <div className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left bg-slate-200/90 hover:bg-slate-200 border-b border-slate-300/80 transition"
      >
        <span className="min-w-0 flex-1 font-bold text-slate-950 text-base">
          Practice
          <span className="font-semibold text-slate-800/90 text-sm ml-2">
            ({results.length})
          </span>
        </span>
        <span className="text-slate-900 text-sm font-bold tabular-nums shrink-0">
          {isOpen ? "▼" : "▶"}
        </span>
      </button>
      {isOpen ? listContent : null}
    </div>
  );
}
