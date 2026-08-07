import { useEffect, useMemo, useState } from "react";
import RecycleBinButton from "./RecycleBinButton";
import SectionSortSelect from "./SectionSortSelect";
import CollapsibleSectionHeader from "./CollapsibleSectionHeader";
import { HUB_TOP_BODY, HUB_TOP_HEADER, HUB_TOP_SHELL } from "../hubSectionStyles";
import {
  RESULTS_ITEM_HEADER,
  RESULTS_ITEM_SHELL,
  RESULTS_ITEM_SHELL_PENDING,
  RESULTS_ITEM_TOGGLE,
  RESULTS_PENDING_BANNER,
  RESULTS_ROW_DETAIL,
  RESULTS_ROW_TITLE,
  RESULTS_SORT_LABEL,
  RESULTS_SCORE_BADGE,
} from "../resultsTypography";
import { CREATE_FIELD_LABEL } from "../createTypography";
import {
  formatWordCount,
  formatWritingGradeLine,
  WRITING_GRADE_OPTIONS,
} from "../writingUtils";
import {
  SECTION_SORT_OPTIONS,
  SECTION_SORT_TIME,
  sortWritingItems,
} from "../sectionSortUtils";

function writingBadgeClass(item) {
  if (!item.grade) return "bg-amber-100 text-amber-900";
  return "bg-green-100 text-green-700";
}

/**
 * Writing submissions accordion for admin Results and student Your Results.
 */
export default function WritingResultsSection({
  submissions,
  openIds,
  toggleOpen,
  onDelete,
  onGrade,
  deletingId,
  gradingId,
  savingFeedbackId,
  variant = "admin",
}) {
  const isAdmin = variant === "admin";
  const [isOpen, setIsOpen] = useState(false);
  const [sortMode, setSortMode] = useState(SECTION_SORT_TIME);
  const [feedbackDrafts, setFeedbackDrafts] = useState({});

  function feedbackFor(item) {
    if (Object.prototype.hasOwnProperty.call(feedbackDrafts, item.id)) {
      return feedbackDrafts[item.id];
    }
    return item.feedback || "";
  }

  function setFeedbackFor(id, value) {
    setFeedbackDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function feedbackDirty(item) {
    return feedbackFor(item) !== (item.feedback || "");
  }

  const pendingCount = submissions.filter((s) => !s.grade).length;

  const sortOptions = useMemo(
    () =>
      pendingCount > 0
        ? [{ value: SECTION_SORT_TIME, label: "Time" }]
        : SECTION_SORT_OPTIONS,
    [pendingCount],
  );

  useEffect(() => {
    if (pendingCount > 0 && sortMode !== SECTION_SORT_TIME) {
      setSortMode(SECTION_SORT_TIME);
    }
  }, [pendingCount, sortMode]);

  const sortedItems = useMemo(
    () => sortWritingItems(submissions, sortMode),
    [submissions, sortMode],
  );

  if (submissions.length === 0) return null;

  return (
    <div className={HUB_TOP_SHELL}>
      <div className={HUB_TOP_HEADER}>
        <CollapsibleSectionHeader
          title="Writing"
          meta={`${submissions.length} submission${submissions.length === 1 ? "" : "s"}`}
          open={isOpen}
          onToggle={() => setIsOpen((v) => !v)}
        />
      </div>
      {isOpen ? (
        <div className={`${HUB_TOP_BODY} gap-3`}>
          {isAdmin && pendingCount > 0 ? (
            <p className={RESULTS_PENDING_BANNER}>
              {pendingCount} writing submission{pendingCount === 1 ? "" : "s"}{" "}
              awaiting your grade
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2 px-0.5">
            <label htmlFor="writing-results-sort" className={RESULTS_SORT_LABEL}>
              Sort
            </label>
            <SectionSortSelect
              id="writing-results-sort"
              value={sortMode}
              onChange={setSortMode}
              options={sortOptions}
            />
          </div>
          {sortedItems.map((item) => {
            const expanded = openIds.has(item.id);
            const isPending = !item.grade;
            const gradeLine = formatWritingGradeLine(item);
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4"
              >
                <div
                  className={
                    isPending ? RESULTS_ITEM_SHELL_PENDING : RESULTS_ITEM_SHELL
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleOpen(item.id)}
                    aria-expanded={expanded}
                    className={RESULTS_ITEM_HEADER}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={RESULTS_ROW_TITLE}>{item.title}</p>
                      {isAdmin && item.student ? (
                        <p className="text-sm text-slate-600 mt-0.5">{item.student}</p>
                      ) : null}
                      <p className={`${RESULTS_ROW_DETAIL} mt-1.5`}>
                        Submitted: {new Date(item.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start sm:items-end gap-1.5">
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-900 border border-violet-200 tabular-nums">
                        {formatWordCount(item.word_count)}
                      </span>
                      <span
                        className={`${RESULTS_SCORE_BADGE} px-2.5 ${writingBadgeClass(item)}`}
                      >
                        {isPending ? "Pending review" : gradeLine}
                      </span>
                      <span className={RESULTS_ITEM_TOGGLE}>
                        {expanded ? "Hide writing" : "Show writing"}
                      </span>
                    </div>
                  </button>
                  {expanded ? (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50/30 space-y-4">
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {item.body}
                      </p>
                      {!isAdmin && item.feedback ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900 mb-2">
                            Teacher feedback
                          </p>
                          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
                            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {item.feedback}
                            </p>
                          </div>
                        </div>
                      ) : null}
                      {isAdmin && onGrade ? (
                        <div className="space-y-4 max-w-xl">
                          <label className={CREATE_FIELD_LABEL}>
                            Grade
                            <select
                              value={item.grade || ""}
                              disabled={gradingId === item.id || savingFeedbackId === item.id}
                              onChange={(e) =>
                                onGrade(item, e.target.value, feedbackFor(item))
                              }
                              className="quill-field-select mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
                            >
                              <option value="">Select grade…</option>
                              {WRITING_GRADE_OPTIONS.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={CREATE_FIELD_LABEL}>
                            Feedback
                            <textarea
                              value={feedbackFor(item)}
                              disabled={gradingId === item.id || savingFeedbackId === item.id}
                              onChange={(e) => setFeedbackFor(item.id, e.target.value)}
                              rows={4}
                              placeholder="Comments for the student…"
                              className="quill-field-textarea mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 resize-y min-h-[6rem]"
                            />
                          </label>
                          {item.grade &&
                          (feedbackDirty(item) || savingFeedbackId === item.id) ? (
                            <button
                              type="button"
                              disabled={
                                gradingId === item.id || savingFeedbackId === item.id
                              }
                              onClick={() =>
                                onGrade(item, item.grade, feedbackFor(item), {
                                  feedbackOnly: true,
                                })
                              }
                              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingFeedbackId === item.id
                                ? "Saving…"
                                : "Save feedback"}
                            </button>
                          ) : item.grade ? null : (
                            <p className="text-xs text-slate-500">
                              Select a grade to save feedback, or pick a grade to
                              save both together.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {isAdmin && onDelete ? (
                  <div className="flex sm:flex-col items-center justify-center shrink-0">
                    <RecycleBinButton
                      onClick={() => onDelete(item)}
                      label={`Delete “${item.title}”`}
                      disabled={deletingId === item.id}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
