import { useEffect, useMemo, useState } from "react";
import AnswerResponseView from "./AnswerResponseView";
import AdminResultGrader from "./AdminResultGrader";
import RecycleBinButton from "./RecycleBinButton";
import {
  ROW_ACTION_BUTTON_CLASS,
  ROW_ACTION_ICON_CLASS,
} from "./rowActionButtonStyles";
import { getWorksheet, analyzeResultForFocus } from "../api";
import { downloadResultJson } from "../resultExportUtils";
import { formatSubjectLabel } from "../subjectUtils";
import { normalizeSubjectKey, subjectSortKey } from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import {
  formatGradeSummary,
  formatResultScoreLine,
  weightedGradeSummary,
} from "../gradeUtils";
import SectionSortSelect from "./SectionSortSelect";
import CollapsibleSectionHeader from "./CollapsibleSectionHeader";
import { HUB_TOP_BODY, HUB_TOP_HEADER, HUB_TOP_SHELL } from "../hubSectionStyles";
import {
  RESULTS_ANSWER_BODY,
  RESULTS_ANSWER_PROMPT,
  RESULTS_ITEM_HEADER,
  RESULTS_ITEM_SHELL,
  RESULTS_ITEM_SHELL_PENDING,
  RESULTS_ITEM_TOGGLE,
  RESULTS_PENDING_BANNER,
  RESULTS_ROW_DETAIL,
  RESULTS_ROW_TITLE,
  RESULTS_SORT_LABEL,
  RESULTS_STATUS_OK,
  RESULTS_SCORE_BADGE,
} from "../resultsTypography";
import {
  SECTION_SORT_TIME,
  sortResultItems,
} from "../sectionSortUtils";

function groupResults(results) {
  const m = new Map();
  for (const r of results) {
    const k = normalizeSubjectKey(r.subject);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return [...m.entries()].sort(
    (a, b) =>
      subjectSortKey(a[0]) - subjectSortKey(b[0]) || a[0].localeCompare(b[0]),
  );
}

function scoreBadgeClass(r) {
  if (r.status === "pending") {
    return "bg-amber-100 text-amber-900";
  }
  if (r.score === r.total) return "bg-green-100 text-green-700";
  if (typeof r.score === "number" && r.score >= r.total / 2) {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-red-100 text-red-700";
}

/**
 * Results accordion by subject (admin or student).
 * Shows weighted letter grade on each subject header and per-result score line.
 */
export default function ResultsBySubject({
  results,
  openIds,
  toggleAnswers,
  expandSubjectKeys = [],
  scrollToOpenResult = false,
  onResultEvaluated,
  onDeleteResult,
  onAnalysisError,
  deletingResultId,
  variant = "admin",
}) {
  const isAdmin = variant === "admin";
  const groups = useMemo(() => groupResults(results), [results]);
  const [openSubjects, setOpenSubjects] = useState(() => new Set());
  const [sortBySubject, setSortBySubject] = useState({});
  const [downloadingResultId, setDownloadingResultId] = useState(null);
  const [analyzingResultId, setAnalyzingResultId] = useState(null);
  const pendingCount = results.filter((r) => r.status === "pending").length;

  useEffect(() => {
    if (!expandSubjectKeys.length) return;
    setOpenSubjects((prev) => {
      const next = new Set(prev);
      expandSubjectKeys.forEach((key) => next.add(key));
      return next;
    });
  }, [expandSubjectKeys]);

  useEffect(() => {
    if (!scrollToOpenResult || openIds.size === 0) return;
    const id = [...openIds][0];
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`result-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openIds, openSubjects, scrollToOpenResult, expandSubjectKeys]);

  async function handleAnalyze(result) {
    setAnalyzingResultId(result.id);
    onAnalysisError?.("");
    try {
      const updated = await analyzeResultForFocus(result.id);
      onResultEvaluated?.(updated);
    } catch (err) {
      onAnalysisError?.(err.message || "Could not analyze result.");
    } finally {
      setAnalyzingResultId(null);
    }
  }

  async function handleDownloadJson(result) {
    setDownloadingResultId(result.id);
    try {
      const worksheet = await getWorksheet(result.worksheet_id);
      downloadResultJson(result, worksheet);
    } catch {
      downloadResultJson(result);
    } finally {
      setDownloadingResultId(null);
    }
  }

  function toggleSubject(subjectKey) {
    setOpenSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      return next;
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {pendingCount > 0 ? (
        <p className={RESULTS_PENDING_BANNER}>
          {isAdmin
            ? `${pendingCount} submission${pendingCount === 1 ? "" : "s"} awaiting your review`
            : `${pendingCount} submission${pendingCount === 1 ? "" : "s"} awaiting teacher review`}
        </p>
      ) : null}
      {groups.map(([subjectKey, items]) => {
        const isOpen = openSubjects.has(subjectKey);
        const sortMode = sortBySubject[subjectKey] || SECTION_SORT_TIME;
        const sortedItems = sortResultItems(items, sortMode);
        const subjectGrade = weightedGradeSummary(items);
        const metaParts = [
          `${items.length} result${items.length === 1 ? "" : "s"}`,
        ];
        if (subjectGrade) {
          metaParts.push(formatGradeSummary(subjectGrade));
        }
        return (
          <div key={subjectKey} className={HUB_TOP_SHELL}>
            <div className={HUB_TOP_HEADER}>
              <CollapsibleSectionHeader
                title={formatSubjectLabel(subjectKey)}
                meta={metaParts.join(" · ")}
                open={isOpen}
                onToggle={() => toggleSubject(subjectKey)}
              />
            </div>
            {isOpen ? (
              <div className={`${HUB_TOP_BODY} gap-3`}>
                <div className="flex items-center justify-end gap-2 px-0.5">
                  <label
                    htmlFor={`results-sort-${subjectKey}`}
                    className={RESULTS_SORT_LABEL}
                  >
                    Sort
                  </label>
                  <SectionSortSelect
                    id={`results-sort-${subjectKey}`}
                    value={sortMode}
                    onChange={(value) =>
                      setSortBySubject((prev) => ({
                        ...prev,
                        [subjectKey]: value,
                      }))
                    }
                  />
                </div>
                {sortedItems.map((r) => {
                  const expanded = openIds.has(r.id);
                  const isPending = r.status === "pending";
                  const scoreLine = formatResultScoreLine(r);
                  return (
                    <div
                      key={r.id}
                      id={expanded ? `result-${r.id}` : undefined}
                      className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4"
                    >
                      <div
                        className={
                          isPending ? RESULTS_ITEM_SHELL_PENDING : RESULTS_ITEM_SHELL
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleAnswers(r.id)}
                          aria-expanded={expanded}
                          className={RESULTS_ITEM_HEADER}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={RESULTS_ROW_TITLE}>
                              {r.title || r.worksheet_id}
                            </p>
                            {isAdmin && r.student ? (
                              <p className={`${RESULTS_ANSWER_BODY} mt-0.5`}>
                                {r.student}
                              </p>
                            ) : null}
                            <p className={`${RESULTS_ROW_DETAIL} mt-1.5`}>
                              Submitted:{" "}
                              {new Date(r.submitted_at).toLocaleString()}
                            </p>
                            {isAdmin && r.focus_evaluation ? (
                              <p className={RESULTS_STATUS_OK}>Analyzed</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                            {r.timed && r.duration_seconds != null ? (
                              <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-900 border border-sky-200 tabular-nums">
                                Completed in{" "}
                                {formatDurationSeconds(r.duration_seconds)}
                              </span>
                            ) : null}
                            <span
                              className={`${RESULTS_SCORE_BADGE} px-2.5 ${scoreBadgeClass(r)}`}
                            >
                              {isPending ? "Pending review" : scoreLine}
                            </span>
                            <span className={RESULTS_ITEM_TOGGLE}>
                              {expanded
                                ? isPending
                                  ? "Hide"
                                  : "Hide answers"
                                : isPending
                                  ? isAdmin
                                    ? "Mark answers"
                                    : "View answers"
                                  : "Show answers"}
                            </span>
                          </div>
                        </button>

                        {expanded && isAdmin ? (
                          <AdminResultGrader
                            result={r}
                            mode={isPending ? "pending" : "override"}
                            onEvaluated={onResultEvaluated}
                          />
                        ) : null}

                        {expanded && !isAdmin ? (
                          <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50/30">
                            <ul className="flex flex-col gap-3">
                              {r.answers.map((a, index) => (
                                <li
                                  key={a.question_id}
                                  className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm"
                                >
                                  <p className={RESULTS_ANSWER_PROMPT}>
                                    <span className="text-indigo-600 font-normal">
                                      {index + 1}.{" "}
                                    </span>
                                    {a.prompt}
                                  </p>
                                  <div className="mt-2 flex flex-col gap-1.5 text-sm">
                                    <span className={RESULTS_ANSWER_BODY}>
                                      Response:
                                    </span>
                                    <AnswerResponseView answer={a} />
                                    {typeof a.correct === "boolean" ? (
                                      <span
                                        className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                                          a.correct
                                            ? "bg-green-50 text-green-800 border-green-200"
                                            : "bg-red-50 text-red-800 border-red-200"
                                        }`}
                                      >
                                        {a.correct ? "Correct" : "Incorrect"}
                                      </span>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                      {onDeleteResult ? (
                        <div className="flex shrink-0 self-center sm:self-stretch sm:items-stretch sm:flex-col sm:justify-center gap-2 sm:w-7">
                          {isAdmin && !isPending ? (
                            <button
                              type="button"
                              onClick={() => handleAnalyze(r)}
                              disabled={
                                analyzingResultId === r.id || Boolean(r.focus_evaluation)
                              }
                              title={
                                r.focus_evaluation
                                  ? "Already analyzed"
                                  : "Analyze focus areas"
                              }
                              aria-label={
                                r.focus_evaluation
                                  ? `Already analyzed: ${r.title || r.worksheet_id}`
                                  : `Analyze focus areas for ${r.title || r.worksheet_id}`
                              }
                              className={`${ROW_ACTION_BUTTON_CLASS} hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700`}
                            >
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
                            </button>
                          ) : null}
                          {isAdmin && !isPending ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadJson(r)}
                              disabled={downloadingResultId === r.id}
                              title="Download result"
                              aria-label={`Download result for ${r.title || r.worksheet_id}`}
                              className={`${ROW_ACTION_BUTTON_CLASS} hover:bg-slate-100 hover:border-slate-300 hover:text-slate-700`}
                            >
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
                                <path d="M12 3v12m0 0l4-4m-4 4l-4-4" />
                                <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                              </svg>
                            </button>
                          ) : null}
                          <RecycleBinButton
                            onClick={() => onDeleteResult(r)}
                            label={`Delete result for ${r.title || r.worksheet_id}`}
                            disabled={deletingResultId === r.id}
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
      })}
    </div>
  );
}
